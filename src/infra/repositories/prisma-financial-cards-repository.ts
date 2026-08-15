import prisma from '@/infra/database/prisma';
import type { CardsRepository } from '@/core/repositories/financial-cards-repository';
import type {
  Card,
  CardUsageFilters,
  CardUsageItem,
  CreateCardData,
  ListCardsParams,
  PaginatedCards,
  UpdateCardData,
} from '@/core/entities/financial-card';
import { ConflictError, NotFoundError } from '@/core/errors/domain-errors';

/**
 * Implementação Prisma de {@link CardsRepository}.
 * Porte fiel de api-nairim-v2/src/services/CardService.ts.
 *
 * DIVERGÊNCIA INTENCIONAL de tenant: o `getCards` do Express não recebia
 * `company_id` (leitura NÃO escopada). Aqui `Card` está em TENANT_MODELS e a
 * extensão injeta `company_id` — leitura escopada, consistente com o menu
 * financeiro (mesmo padrão de Subcategory).
 *
 * Camada: infra.
 */

type CardRow = Card & { deleted_at: Date | null };

/** `Card.limit`/`Card.current_balance` são `@db.Decimal` — Prisma devolve
 * instância de `Decimal`, incompatível com o boundary RSC (Client Components). */
function serializeCard<T extends { limit?: unknown; current_balance?: unknown }>(card: T): T {
  return {
    ...card,
    limit: card.limit != null ? Number(card.limit) : card.limit,
    current_balance: card.current_balance != null ? Number(card.current_balance) : card.current_balance,
  };
}

function serializeCards<T extends { limit?: unknown; current_balance?: unknown }>(cards: T[]): T[] {
  return cards.map(serializeCard);
}

const DIRECT_SORTABLE_FIELDS = ['name', 'limit', 'closing_day', 'due_day', 'is_active', 'created_at'];

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeSortDirection(direction: string): 'asc' | 'desc' {
  return String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function normalizeLimitValue(value: string): number | null {
  let strValue = String(value);
  if (strValue.includes(',')) {
    strValue = strValue.replace(/\./g, '').replace(',', '.');
  }
  const numeric = Number(strValue.replace(/[^\d.-]/g, ''));
  return isNaN(numeric) ? null : numeric;
}

function buildWhere(filters: Record<string, unknown>, includeInactive: boolean): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!includeInactive) where.deleted_at = null;

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'name') {
      where[key] = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'is_active') {
      where[key] = value === 'true' || value === true;
    } else if (key === 'closing_day') {
      where.closing_day = Number(value);
    } else if (key === 'due_day') {
      where.due_day = Number(value);
    } else if (key === 'card_limit') {
      const numericValue = normalizeLimitValue(String(value));
      if (numericValue !== null) {
        if (numericValue === 0) {
          where.OR = [{ limit: 0 }, { limit: null }];
        } else {
          where.limit = numericValue;
        }
      }
    }
  });
  return where;
}

function buildOrderBy(sortOptions: Record<string, string>): Record<string, unknown>[] {
  const orderBy: Record<string, unknown>[] = [];
  Object.entries(sortOptions).forEach(([field, direction]) => {
    if (DIRECT_SORTABLE_FIELDS.includes(field)) orderBy.push({ [field]: normalizeSortDirection(direction) });
  });
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
  return orderBy;
}

function formatBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

function filterCardsBySearch(cards: CardRow[], searchTerm: string): CardRow[] {
  if (!searchTerm.trim()) return cards;
  const normalizedSearchTerm = normalizeText(searchTerm);

  return cards.filter((card) => {
    const statusTextSearch = card.is_active ? 'ativo' : 'inativo';
    const limitNumber = card.limit != null && Number(card.limit) > 0 ? Number(card.limit) : 0;
    const formattedLimit = limitNumber > 0 ? formatBRL(limitNumber) : 'sem limite';
    const fechamentoPt = card.closing_day ? `fechamento dia ${card.closing_day}` : '';
    const vencimentoPt = card.due_day ? `vencimento dia ${card.due_day}` : '';

    const fieldsToSearch = [
      card.name,
      String(card.limit ?? ''),
      formattedLimit,
      String(card.closing_day ?? ''),
      String(card.due_day ?? ''),
      fechamentoPt,
      vencimentoPt,
      statusTextSearch,
    ].filter(Boolean).join(' ');

    return normalizeText(fieldsToSearch).includes(normalizedSearchTerm);
  });
}

function sortCards(cards: CardRow[], sortOptions: Record<string, string>): CardRow[] {
  const entries = Object.entries(sortOptions);
  if (entries.length === 0) {
    return [...cards].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  const field = entries[0][0];
  const direction = normalizeSortDirection(entries[0][1]);

  return [...cards].sort((a, b) => {
    const valA = (a as unknown as Record<string, unknown>)[field];
    const valB = (b as unknown as Record<string, unknown>)[field];
    if (typeof valA === 'number' || typeof valB === 'number') {
      return direction === 'asc' ? Number(valA || 0) - Number(valB || 0) : Number(valB || 0) - Number(valA || 0);
    }
    if (typeof valA === 'boolean' || typeof valB === 'boolean') {
      return direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    }
    const strA = String(valA || '');
    const strB = String(valB || '');
    return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

export class PrismaFinancialCardsRepository implements CardsRepository {
  async list(params: ListCardsParams): Promise<PaginatedCards> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters, params.includeInactive);

    let cards: CardRow[] = [];
    let total = 0;

    if (params.search?.trim()) {
      // Busca em memória: igual ao backend.
      const allCards = (await prisma.card.findMany({ where: where as never })) as CardRow[];
      const filtered = filterCardsBySearch(allCards, params.search ?? '');
      total = filtered.length;
      cards = sortCards(filtered, params.sortOptions).slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.card.findMany({ where: where as never, skip, take, orderBy: buildOrderBy(params.sortOptions) as never }),
        prisma.card.count({ where: where as never }),
      ]);
      cards = data as CardRow[];
      total = count;
    }

    return { data: serializeCards(cards), count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(): Promise<Record<string, unknown>> {
    const existingCards = await prisma.card.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, limit: true },
      orderBy: { name: 'asc' },
    });

    const uniqueNames = Array.from(new Set(existingCards.map((c) => c.name)));
    const nameOptions = uniqueNames.map((name) => ({ label: name, value: name }));

    const uniqueLimits = Array.from(
      new Set(
        existingCards
          .map((c) => (c.limit !== null && c.limit !== undefined ? Number(c.limit) : null))
          .filter((val): val is number => val !== null),
      ),
    ).sort((a, b) => a - b);

    const limitOptions = uniqueLimits.map((limit) => ({
      label: formatBRL(limit),
      value: String(limit),
    }));

    const hasNoLimit = existingCards.some((c) => !c.limit || Number(c.limit) === 0);
    if (hasNoLimit) {
      limitOptions.unshift({ label: 'Sem limite / R$ 0,00', value: '0' });
    }

    return {
      filters: [
        { field: 'name', type: 'select', label: 'Nome do Cartão', values: nameOptions, searchable: true },
        {
          field: 'is_active',
          type: 'select',
          label: 'Status',
          values: [
            { label: 'Ativo', value: 'true' },
            { label: 'Inativo', value: 'false' },
          ],
        },
        { field: 'card_limit', type: 'select', label: 'Limite', values: limitOptions, searchable: true },
        { field: 'created_at', type: 'date', label: 'Data de Criação', dateRange: true },
      ],
      defaultSort: 'created_at:desc',
      searchFields: ['name'],
    };
  }

  async findById(id: string): Promise<Card | null> {
    const card = await prisma.card.findUnique({ where: { id, deleted_at: null } });
    return card ? (serializeCard(card as Card)) : null;
  }

  async create(data: CreateCardData): Promise<Card> {
    // `company_id` é injetado pela extensão multi-tenant a partir do contexto.
    const created = await prisma.card.create({
      data: {
        name: data.name,
        limit: data.limit !== null && data.limit !== undefined ? Number(data.limit) : undefined,
        closing_day: data.closing_day !== null && data.closing_day !== undefined ? Number(data.closing_day) : null,
        due_day: data.due_day !== null && data.due_day !== undefined ? Number(data.due_day) : null,
        is_active: data.is_active ?? true,
      } as never,
    });
    return serializeCard(created as Card);
  }

  async update(id: string, data: UpdateCardData): Promise<Card> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.limit !== undefined) updateData.limit = data.limit !== null ? Number(data.limit) : undefined;
    if (data.closing_day !== undefined) updateData.closing_day = data.closing_day !== null ? Number(data.closing_day) : null;
    if (data.due_day !== undefined) updateData.due_day = data.due_day !== null ? Number(data.due_day) : null;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const updated = await prisma.card.update({ where: { id }, data: updateData });
    return serializeCard(updated as Card);
  }

  async softDelete(id: string): Promise<Card> {
    const card = await prisma.card.findUnique({ where: { id, deleted_at: null } });
    if (!card) throw new NotFoundError('Cartão não encontrado ou já excluído');

    const hasTransactions = await prisma.transaction.findFirst({ where: { card_id: id, deleted_at: null } });
    if (hasTransactions) {
      throw new ConflictError('Não é possível excluir o cartão pois existem lançamentos vinculados.');
    }

    const updated = await prisma.card.update({ where: { id }, data: { deleted_at: new Date() } });
    return serializeCard(updated as Card);
  }

  async findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null> {
    const card = await prisma.card.findUnique({ where: { id }, select: { id: true, deleted_at: true } });
    return card ?? null;
  }

  async restore(id: string): Promise<Card> {
    const updated = await prisma.card.update({ where: { id }, data: { deleted_at: null } });
    return serializeCard(updated as Card);
  }

  async quickCreate(data: { name: string }): Promise<Card> {
    const name = String(data.name ?? '').trim();
    if (!name) throw new Error('Nome é obrigatório');

    const existing = await prisma.card.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, deleted_at: null },
    });
    if (existing) return serializeCard(existing as Card);

    const created = await prisma.card.create({
      data: { name, is_active: true } as never,
    });
    return serializeCard(created as Card);
  }

  async getUsageSummary(startDate: Date, endDate: Date, filters: CardUsageFilters): Promise<CardUsageItem[]> {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) end.setHours(23, 59, 59, 999);

    const cards = await prisma.card.findMany({
      where: { deleted_at: null, is_active: true },
      select: { id: true, name: true, limit: true },
      orderBy: { name: 'asc' },
    });

    const extraWhere: Record<string, { in: string[] }> = {};
    for (const field of ['category_id', 'subcategory_id', 'financial_institution_id', 'card_id', 'center_id', 'supplier_id'] as const) {
      if (filters[field]?.length) extraWhere[field] = { in: filters[field] };
    }

    const usageGroups = await prisma.transaction.groupBy({
      by: ['card_id'],
      where: {
        deleted_at: null,
        NOT: { is_transfer: true },
        card_id: { not: null },
        category: { type: 'EXPENSE' },
        ...extraWhere,
        AND: [
          {
            OR: [
              { event_date: { gte: start, lte: end } },
              { effective_date: { gte: start, lte: end } },
            ],
          },
          ...(filters.description?.length
            ? [{ OR: filters.description.map((d) => ({ description: { contains: d, mode: 'insensitive' as const } })) }]
            : []),
        ],
      } as never,
      _sum: { amount: true },
    });

    const consumedByCardId = new Map(usageGroups.map((g) => [g.card_id as string, Number(g._sum.amount ?? 0)]));

    return cards.map((card) => ({
      cardId: card.id,
      name: card.name,
      limit: Number(card.limit ?? 0),
      consumed: consumedByCardId.get(card.id) ?? 0,
    }));
  }
}