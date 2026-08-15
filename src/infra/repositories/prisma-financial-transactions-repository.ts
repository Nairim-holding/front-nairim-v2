import { randomUUID } from 'node:crypto';
import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { TransactionsRepository } from '@/core/repositories/financial-transactions-repository';
import type {
  AvailableYearsResult,
  CreateInstallmentsData,
  CreateRecurrenceData,
  CreateTransactionData,
  CreateTransferData,
  ExpenseByCategoryResult,
  InstallmentsResult,
  ListTransactionsParams,
  MonthlySummary,
  MonthlySummaryMultiResult,
  PaginatedTransactions,
  RecurrenceResult,
  RelatedTransactionsResult,
  SubcategoryBreakdownResult,
  Transaction,
  TransactionDocument,
  TransactionEntityFilters,
  TransactionFiltersResult,
  TransactionSummary,
  TransactionTotals,
  TransferResult,
  UpdateTransactionData,
} from '@/core/entities/financial-transaction';
import { parseLocalDate, displayDate } from '@/shared/utils/date-utils';
import {
  buildPropagatedDescription,
  parseSeriesDescription,
  sanitizePropagateFields,
  type PropagatableField,
} from '@/shared/utils/series-propagation';
import { NotFoundError } from '@/core/errors/domain-errors';

/**
 * Implementacao Prisma de {@link TransactionsRepository}.
 * Porte fiel de api-nairim-v2/src/services/TransactionService.ts +
 * TransferService.ts + RecurringService.ts.
 *
 * Tenant: `Transaction`/`Invoice`/`RecurringConfig` estao em TENANT_MODELS e a
 * extensao injeta `company_id` nas leituras e nos creates (inclusive dentro de
 * `$transaction`). O backend Express nao recebia company_id nas leituras de
 * transaction; aqui a leitura fica escopada, consistente com o menu financeiro.
 *
 * Camada: infra.
 */

const RELATION_SORT_FIELDS: Record<string, string> = {
  category_id: 'category.name',
  subcategory_id: 'subcategory.name',
  financial_institution_id: 'financial_institution.name',
  card_id: 'card.name',
  center_id: 'center.name',
  supplier_id: 'supplier.legal_name',
};

const DIRECT_SORTABLE_FIELDS = ['event_date', 'effective_date', 'amount', 'status', 'description', 'created_at'];

const ENTITY_FILTER_FIELDS = [
  'category_id',
  'subcategory_id',
  'financial_institution_id',
  'card_id',
  'center_id',
  'supplier_id',
] as const;

const INCLUDE_CONFIG = {
  category: true,
  subcategory: true,
  financial_institution: true,
  card: true,
  center: true,
  supplier: true,
  _count: { select: { documents: { where: { deleted_at: null } } } },
};

/** `Card.limit`/`Card.current_balance` são `@db.Decimal` — mesma serialização
 * necessária sempre que a transação vem com `card` incluído (list/findById). */
function serializeCard(card: any): any {
  if (!card) return card;
  return {
    ...card,
    limit: card.limit != null ? Number(card.limit) : card.limit,
    current_balance: card.current_balance != null ? Number(card.current_balance) : card.current_balance,
  };
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeSortDirection(direction: string): 'asc' | 'desc' {
  return String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function safeGetProperty(obj: any, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        acc && (acc as Record<string, unknown>)[part] !== undefined ? (acc as Record<string, unknown>)[part] : undefined,
      obj,
    );
}

function buildDateCondition(value: unknown): { gte?: Date; lte?: Date } {
  if (typeof value === 'object' && value !== null && 'from' in value && 'to' in value) {
    const fromDate = parseLocalDate(String((value as { from: string }).from));
    const toDate = parseLocalDate(String((value as { to: string }).to));
    toDate.setUTCHours(23, 59, 59, 999);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) return { gte: fromDate, lte: toDate };
  } else if (typeof value === 'string') {
    const date = parseLocalDate(value);
    if (!isNaN(date.getTime())) {
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);
      return { gte: startOfDay, lte: endOfDay };
    }
  }
  return {};
}

function buildAmountRangeCondition(value: unknown): Record<string, number> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && ('min' in value || 'max' in value)) {
    const cond: Record<string, number> = {};
    const rawMin = (value as Record<string, unknown>).min;
    const rawMax = (value as Record<string, unknown>).max;
    const min = Number(String(rawMin).replace(/[^\d.-]/g, ''));
    const max = Number(String(rawMax).replace(/[^\d.-]/g, ''));
    if (rawMin !== undefined && rawMin !== null && rawMin !== '' && !isNaN(min)) cond.gte = min;
    if (rawMax !== undefined && rawMax !== null && rawMax !== '' && !isNaN(max)) cond.lte = max;
    return cond;
  }
  const numericValue = Number(String(value).replace(/[^\d.-]/g, ''));
  return isNaN(numericValue) ? {} : { equals: numericValue };
}

function filterTransactionsBySearch(transactions: any[], searchTerm: string): any[] {
  if (!searchTerm.trim()) return transactions;
  const normalizedSearchTerm = normalizeText(searchTerm);

  return transactions.filter((t) => {
    const statusPt = t.status === 'COMPLETED' ? 'concluido' : t.status === 'PENDING' ? 'pendente' : '';
    const typePt = t.category?.type === 'INCOME' ? 'receita' : t.category?.type === 'EXPENSE' ? 'despesa' : '';

    const formattedAmount = t.amount
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.amount))
      : '';
    const formattedEventDate = t.event_date ? displayDate(t.event_date) : '';
    const formattedEffectiveDate = t.effective_date ? displayDate(t.effective_date) : '';

    const fieldsToSearch = [
      t.description,
      String(t.amount),
      formattedAmount,
      statusPt,
      typePt,
      t.category?.name,
      t.subcategory?.name,
      t.financial_institution?.name,
      t.card?.name,
      t.center?.name,
      t.supplier?.legal_name,
      formattedEventDate,
      formattedEffectiveDate,
    ]
      .filter(Boolean)
      .join(' ');

    return normalizeText(fieldsToSearch).includes(normalizedSearchTerm);
  });
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const clean = value.replace(/[R$\s]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/** Filtros de relatorios/dashboard (chave repetida) em um `where` Prisma. */
function buildEntityFilterWhere(filters: Record<string, string[]> = {}): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const field of ENTITY_FILTER_FIELDS) {
    if (filters[field]?.length) where[field] = { in: filters[field] };
  }
  if (filters.description?.length) {
    where.OR = filters.description.map((d) => ({ description: { contains: d, mode: 'insensitive' as const } }));
  }
  return where;
}

const YEARS_AHEAD = 5;

type RecurringFrequency =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'YEARLY';

function computeOccurrenceDate(baseDate: Date, index: number, frequency: RecurringFrequency): Date {
  const y = baseDate.getUTCFullYear();
  const m = baseDate.getUTCMonth();
  const d = baseDate.getUTCDate();

  const addDays = (days: number) => new Date(Date.UTC(y, m, d + days));

  const addMonths = (months: number) => {
    const targetMonthFirst = new Date(Date.UTC(y, m + months, 1));
    const ty = targetMonthFirst.getUTCFullYear();
    const tm = targetMonthFirst.getUTCMonth();
    const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ty, tm, Math.min(d, lastDay)));
  };

  switch (frequency) {
    case 'WEEKLY':
      return addDays(7 * index);
    case 'BIWEEKLY':
      return addDays(14 * index);
    case 'MONTHLY':
      return addMonths(index);
    case 'BIMONTHLY':
      return addMonths(2 * index);
    case 'QUARTERLY':
      return addMonths(3 * index);
    case 'SEMIANNUAL':
      return addMonths(6 * index);
    case 'YEARLY':
      return addMonths(12 * index);
    default:
      return addMonths(index);
  }
}

export class PrismaFinancialTransactionsRepository implements TransactionsRepository {
  async list(params: ListTransactionsParams): Promise<PaginatedTransactions> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;

    const where: Record<string, unknown> = {};
    if (!params.includeInactive) where.deleted_at = null;

    Object.entries(params.filters).forEach(([key, value]) => {
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return;
      const values = Array.isArray(value) ? value : [value];

      if (key === 'status') where.status = { in: values.map(String) };
      if (ENTITY_FILTER_FIELDS.includes(key as (typeof ENTITY_FILTER_FIELDS)[number])) {
        where[key] = { in: values.map(String) };
      }
      if (key === 'type') (where as Record<string, unknown>).category = { type: value };
      if (key === 'description') {
        where.OR = values.map((v) => ({ description: { contains: String(v), mode: 'insensitive' } }));
      }
      if (key === 'amount') {
        const amountCond = buildAmountRangeCondition(value);
        if (Object.keys(amountCond).length > 0) where.amount = amountCond;
      }
      if (key === 'event_date' || key === 'effective_date') {
        const dateCond = buildDateCondition(value);
        if (Object.keys(dateCond).length > 0) where[key] = dateCond;
      }
    });

    let transactions: any[] = [];
    let total = 0;

    if ((params.search ?? '').trim()) {
      const allTransactions = (await prisma.transaction.findMany({
        where: where as never,
        include: INCLUDE_CONFIG as never,
      })) as unknown as any[];
      let filtered = filterTransactionsBySearch(allTransactions, params.search ?? '');
      total = filtered.length;

      const sortEntries = Object.entries(params.sortOptions);
      if (sortEntries.length > 0) {
        const field = sortEntries[0][0];
        const direction = normalizeSortDirection(sortEntries[0][1]);
        const realField = RELATION_SORT_FIELDS[field] ?? field;

        filtered = filtered.sort((a, b) => {
          let valA: unknown = safeGetProperty(a, realField);
          let valB: unknown = safeGetProperty(b, realField);
          if (valA === undefined) valA = a[field];
          if (valB === undefined) valB = b[field];

          if (typeof valA === 'number' || (valA instanceof Date)) {
            return direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
          }
          const strA = normalizeText(String(valA || ''));
          const strB = normalizeText(String(valB || ''));
          return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        });
      } else {
        filtered = filtered.sort(
          (a, b) => parseLocalDate(b.event_date).getTime() - parseLocalDate(a.event_date).getTime(),
        );
      }

      transactions = filtered.slice(skip, skip + take);
    } else {
      const orderBy: Record<string, unknown>[] = [];
      Object.entries(params.sortOptions).forEach(([field, direction]) => {
        const dir = normalizeSortDirection(direction);
        if (DIRECT_SORTABLE_FIELDS.includes(field)) {
          orderBy.push({ [field]: dir });
        } else if (RELATION_SORT_FIELDS[field]) {
          const [relation, relationField] = RELATION_SORT_FIELDS[field].split('.');
          orderBy.push({ [relation]: { [relationField]: dir } });
        }
      });
      if (orderBy.length === 0) orderBy.push({ event_date: 'desc' });

      const [data, count] = await Promise.all([
        prisma.transaction.findMany({
          where: where as never,
          skip,
          take,
          orderBy: orderBy as never,
          include: INCLUDE_CONFIG as never,
        }),
        prisma.transaction.count({ where: where as never }),
      ]);
      transactions = (data as unknown) as any[];
      total = count;
    }

    // ⚠️ Achado em teste E2E (2026-08-13): `Transaction.amount` é `@db.Decimal` —
    // sem esta conversão, o Prisma devolve uma instância de `Decimal`, que
    // quebra o boundary RSC ao ser passada para Client Components (mesma
    // causa raiz corrigida em prisma-properties/leases/agencies-repository.ts).
    const mappedTransactions = transactions.map((t) => ({
      ...t,
      amount: t.amount != null ? Number(t.amount) : t.amount,
      subcategory: t.subcategory ? { name: t.subcategory.name } : { name: 'Nenhuma' },
      card: serializeCard(t.card),
      _attachmentsCount: t._count?.documents ?? 0,
    }));

    const aggregations = (await prisma.transaction.groupBy({
      by: ['status'],
      where: where as never,
      _sum: { amount: true },
    })) as unknown as TransactionSummary[];

    const sumByType = async (scope: Record<string, unknown>, type: 'INCOME' | 'EXPENSE'): Promise<number> => {
      const result = await prisma.transaction.aggregate({
        where: { ...scope, category: { ...(scope.category ?? {}), type } } as never,
        _sum: { amount: true },
      });
      return Number(result._sum.amount ?? 0);
    };

    const sumByTypeStatus = async (
      scope: Record<string, unknown>,
      type: 'INCOME' | 'EXPENSE',
      status: 'PENDING' | 'COMPLETED',
    ): Promise<number> => {
      const { status: scopeStatus, ...rest } = scope;
      const result = await prisma.transaction.aggregate({
        where: {
          ...rest,
          category: { ...(rest.category ?? {}), type },
          NOT: { is_transfer: true },
          AND: [...(scopeStatus ? [{ status: scopeStatus }] : []), { status }],
        } as never,
        _sum: { amount: true },
      });
      return Number(result._sum.amount ?? 0);
    };

    const accumulatedWhere: Record<string, unknown> = { ...where };
    for (const dateField of ['effective_date', 'event_date']) {
      const cond = accumulatedWhere[dateField];
      if (cond && typeof cond === 'object' && 'lte' in cond) {
        accumulatedWhere[dateField] = { lte: (cond as { lte: Date }).lte };
      }
    }
    accumulatedWhere.status = 'COMPLETED';

    const [
      periodIncome,
      periodExpense,
      accumulatedIncome,
      accumulatedExpense,
      receitasPrevisto,
      receitasRecebido,
      despesasPrevisto,
      despesasPago,
    ] = await Promise.all([
      sumByType(where, 'INCOME'),
      sumByType(where, 'EXPENSE'),
      sumByType(accumulatedWhere, 'INCOME'),
      sumByType(accumulatedWhere, 'EXPENSE'),
      sumByTypeStatus(where, 'INCOME', 'PENDING'),
      sumByTypeStatus(where, 'INCOME', 'COMPLETED'),
      sumByTypeStatus(where, 'EXPENSE', 'PENDING'),
      sumByTypeStatus(where, 'EXPENSE', 'COMPLETED'),
    ]);

    const totals: TransactionTotals = {
      periodIncome,
      periodExpense,
      periodBalance: periodIncome - periodExpense,
      accumulatedIncome,
      accumulatedExpense,
      accumulatedBalance: accumulatedIncome - accumulatedExpense,
      receitasPrevisto,
      receitasRecebido,
      despesasPrevisto,
      despesasPago,
    };

    return {
      data: mappedTransactions,
      count: total,
      totalPages: Math.ceil(total / take),
      currentPage: params.page,
      summary: aggregations.map((g) => ({
        ...g,
        _sum: {
          amount: g._sum ? Number((g._sum as unknown as { amount: unknown }).amount ?? 0) : null,
        },
      })),
      totals,
    };
  }

  async getFilters(filters?: Record<string, unknown>): Promise<TransactionFiltersResult> {
    const where: Record<string, unknown> = { deleted_at: null };

    if (filters) {
      const andFilters: Record<string, unknown>[] = [];
      Object.entries(filters).forEach(([key, value]) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return;
        const values = Array.isArray(value) ? value : [value];

        if (key === 'status') andFilters.push({ status: { in: values.map(String) } });
        if (ENTITY_FILTER_FIELDS.includes(key as (typeof ENTITY_FILTER_FIELDS)[number])) {
          andFilters.push({ [key]: { in: values.map(String) } });
        }
        if (key === 'type') andFilters.push({ category: { type: value } });
        if (key === 'description') {
          andFilters.push({
            OR: values.map((v) => ({ description: { contains: String(v), mode: 'insensitive' } })),
          });
        }
        if (key === 'amount') {
          const amountCond = buildAmountRangeCondition(value);
          if (Object.keys(amountCond).length > 0) andFilters.push({ amount: amountCond });
        }
        if (key === 'event_date' || key === 'effective_date') {
          const dateCond = buildDateCondition(value);
          if (Object.keys(dateCond).length > 0) andFilters.push({ [key]: dateCond });
        }
      });
      if (andFilters.length) where.AND = andFilters;
    }

    const [transactions, categories, subcategories, institutions, cards, centers, suppliers] = await Promise.all([
      prisma.transaction.findMany({
        where: where as never,
        distinct: ['description', 'status', 'amount'],
        select: { description: true, status: true, amount: true },
      }),
      prisma.category.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
      }),
      prisma.subcategory.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true, category_id: true },
        orderBy: { name: 'asc' },
      }),
      prisma.financialInstitution.findMany({
        where: { deleted_at: null, is_active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.card.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.center.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.findMany({
        where: { deleted_at: null },
        select: { id: true, legal_name: true },
        orderBy: { legal_name: 'asc' },
      }),
    ]);

    const uniqueDescriptions = Array.from(new Set(transactions.map((t) => t.description).filter(Boolean))).sort();

    return {
      filters: [
        {
          field: 'category_id',
          type: 'select',
          label: 'Categoria',
          multiple: true,
          values: categories.map((c) => ({
            value: c.id,
            label: `${c.name} (${c.type === 'INCOME' ? 'Receita' : 'Despesa'})`,
          })),
        },
        {
          field: 'subcategory_id',
          type: 'select',
          label: 'Subcategoria',
          multiple: true,
          dependsOn: { field: 'category_id', matchKey: 'category_id' },
          values: subcategories.map((s) => ({ value: s.id, label: s.name, category_id: s.category_id })),
        },
        {
          field: 'financial_institution_id',
          type: 'select',
          label: 'Instituição Financeira',
          multiple: true,
          values: institutions.map((i) => ({ value: i.id, label: i.name })),
        },
        {
          field: 'card_id',
          type: 'select',
          label: 'Cartão',
          multiple: true,
          values: cards.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          field: 'center_id',
          type: 'select',
          label: 'Centro',
          multiple: true,
          values: centers.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          field: 'supplier_id',
          type: 'select',
          label: 'Fornecedor',
          multiple: true,
          values: suppliers.map((s) => ({ value: s.id, label: s.legal_name })),
        },
        {
          field: 'description',
          type: 'select',
          label: 'Descrição',
          multiple: true,
          searchable: true,
          values: uniqueDescriptions.map((d) => ({ label: d, value: d })),
        },
        { field: 'amount', type: 'number', label: 'Valor', numberRange: true },
        {
          field: 'status',
          type: 'select',
          label: 'Status',
          multiple: true,
          values: [
            { value: 'PENDING', label: 'Pendente' },
            { value: 'COMPLETED', label: 'Concluído' },
          ],
        },
      ],
      operators: {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        select: ['equals', 'in'],
      },
      defaultSort: 'event_date:desc',
      searchFields: ['description'],
    };
  }

  async findById(id: string): Promise<Transaction | null> {
    const transaction = (await prisma.transaction.findUnique({
      where: { id, deleted_at: null },
      include: {
        category: true,
        subcategory: true,
        financial_institution: true,
        card: true,
        center: true,
        supplier: true,
      },
    })) as unknown as (Transaction & { amount: unknown; card: unknown }) | null;
    if (transaction && transaction.amount != null) transaction.amount = Number(transaction.amount) as never;
    if (transaction) transaction.card = serializeCard(transaction.card) as never;
    return transaction as unknown as Transaction | null;
  }

  // ─── Fatura (minimo do InvoiceService; total no Modulo 9h) ────────────────
  // `client` pode ser `prisma` (extensão injeta company_id) ou `tx` (dentro de
  // $transaction, NÃO passa pela extensão) — por isso `companyId` é sempre
  // explícito aqui, nunca assumido como injetado automaticamente.
  private async findOrCreateInvoice(
    client: { invoice: any; card: any },
    cardId: string,
    month: number,
    year: number,
    companyId: string,
  ): Promise<{ id: string }> {
    let invoice = await client.invoice.findFirst({ where: { card_id: cardId, month, year, company_id: companyId } });
    if (invoice) return invoice;

    const card = await client.card.findUnique({ where: { id: cardId, company_id: companyId } });
    if (!card) throw new Error('Cartão não encontrado');

    const closingDay = card.closing_day ?? 1;
    const dueDay = card.due_day ?? 10;
    const closingDate = new Date(Date.UTC(year, month - 1, closingDay));
    let dueDate = new Date(Date.UTC(year, month - 1, dueDay));
    if (dueDate < closingDate) dueDate = new Date(Date.UTC(year, month, dueDay));

    return client.invoice.create({
      data: {
        company_id: companyId,
        card_id: cardId,
        month,
        year,
        closing_date: closingDate,
        due_date: dueDate,
        total_amount: 0,
        paid_amount: 0,
        status: 'PENDING',
      } as never,
    });
  }

  async create(data: CreateTransactionData & { company_id?: string }): Promise<Transaction> {
    let invoiceId: string | null = null;
    const cardId = data.card_id || null;

    if (cardId && data.effective_date) {
      const effectiveDate = parseLocalDate(data.effective_date);
      const invoiceMonth = effectiveDate.getUTCMonth() + 1;
      const invoiceYear = effectiveDate.getUTCFullYear();

      try {
        const companyId = getCurrentCompanyId();
        if (!companyId) throw new Error('Contexto de empresa não identificado.');
        const invoice = await this.findOrCreateInvoice(prisma, cardId, invoiceMonth, invoiceYear, companyId);
        invoiceId = invoice.id;
      } catch (error) {
        console.warn(`Não foi possível vincular à fatura: ${(error as Error).message}`);
      }
    }

    const transaction = (await prisma.transaction.create({
      data: {
        event_date: parseLocalDate(data.event_date),
        effective_date: parseLocalDate(data.effective_date),
        description: data.description ?? '',
        amount: Number(data.amount),
        status: data.status || 'PENDING',
        category_id: data.category_id,
        subcategory_id: data.subcategory_id || null,
        financial_institution_id: data.financial_institution_id,
        card_id: data.card_id || null,
        center_id: data.center_id || null,
        supplier_id: data.supplier_id || null,
        invoice_id: invoiceId,
      } as never,
      include: { category: true, financial_institution: true, supplier: true } as never,
    })) as unknown as Transaction;

    if (invoiceId) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { total_amount: { increment: Number(data.amount) } },
      });
    }

    return transaction;
  }

  async update(id: string, data: UpdateTransactionData): Promise<Transaction> {
    const existing = (await prisma.transaction.findUnique({ where: { id, deleted_at: null } })) as any;
    if (!existing) throw new NotFoundError('Lançamento não encontrado');

    const parseFKUpdate = (val: unknown): string | null | undefined => {
      if (val === '' || val === 'null' || val === null) return null;
      return val !== undefined ? String(val) : undefined;
    };

    const updated = (await prisma.transaction.update({
      where: { id },
      data: {
        event_date: data.event_date ? parseLocalDate(data.event_date) : undefined,
        effective_date: data.effective_date ? parseLocalDate(data.effective_date) : undefined,
        description: data.description ?? undefined,
        amount: data.amount !== undefined ? Number(data.amount) : undefined,
        status: data.status,
        category_id: data.category_id,
        subcategory_id: parseFKUpdate(data.subcategory_id),
        financial_institution_id: data.financial_institution_id,
        card_id: parseFKUpdate(data.card_id),
        center_id: parseFKUpdate(data.center_id),
        supplier_id: parseFKUpdate(data.supplier_id),
      },
      include: { category: true, financial_institution: true, supplier: true } as never,
    })) as unknown as Transaction;

    // Cascata do par de transferência: espelha campos financeiros na outra perna.
    if (existing.is_transfer && existing.transfer_group_id) {
      await prisma.transaction.updateMany({
        where: {
          transfer_group_id: existing.transfer_group_id,
          id: { not: id },
          deleted_at: null,
        },
        data: {
          amount: data.amount !== undefined ? Number(data.amount) : undefined,
          event_date: data.event_date ? parseLocalDate(data.event_date) : undefined,
          effective_date: data.effective_date ? parseLocalDate(data.effective_date) : undefined,
          status: data.status,
        },
      }) as unknown as never;
    }

    // Propagação para as parcelas/ocorrências SEGUINTES da mesma série.
    if (data.propagate_to_following === true) {
      await this.propagateToFollowing(existing, updated, sanitizePropagateFields(data.propagate_fields));
    }

    return updated;
  }

  private async propagateToFollowing(existing: any, updated: any, fields: PropagatableField[]) {
    const isInstallment = !!existing.installment_group_id && existing.installment_number != null;
    const isRecurring = !!existing.recurring_group_id && existing.occurrence_number != null;
    if (!isInstallment && !isRecurring) return;

    const where: any = isInstallment
      ? {
          installment_group_id: existing.installment_group_id,
          installment_number: { gt: existing.installment_number },
          status: 'PENDING',
          deleted_at: null,
        }
      : {
          recurring_group_id: existing.recurring_group_id,
          occurrence_number: { gt: existing.occurrence_number },
          status: 'PENDING',
          deleted_at: null,
        };

    const propagatesDescription = fields.includes('description');
    const uniform: Record<string, unknown> = {};
    for (const field of fields) {
      if (field === 'description') continue;
      uniform[field] = updated[field];
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(uniform).length > 0) {
        await tx.transaction.updateMany({ where, data: uniform });
      }

      if (propagatesDescription) {
        const targets = (await tx.transaction.findMany({
          where,
          select: { id: true, description: true },
        })) as unknown as { id: string; description: string }[];

        for (const target of targets) {
          const description = buildPropagatedDescription(updated.description, target.description);
          if (description === target.description) continue;
          await tx.transaction.update({ where: { id: target.id }, data: { description } });
        }
      }

      // Recorrência infinita: as próximas ocorrências nascem da RecurringConfig.
      if (isRecurring) {
        const configData: Record<string, unknown> = { ...uniform };
        if (propagatesDescription) {
          configData.description =
            parseSeriesDescription(updated.description).base || String(updated.description ?? '').trim();
        }

        if (Object.keys(configData).length > 0) {
          await tx.recurringConfig.updateMany({
            where: { id: existing.recurring_group_id, deleted_at: null },
            data: configData,
          });
        }
      }
    });
  }

  async delete(id: string): Promise<Transaction> {
    const transaction = (await prisma.transaction.findUnique({ where: { id, deleted_at: null } })) as any;
    if (!transaction) throw new NotFoundError('Lançamento não encontrado ou já excluído');

    const now = new Date();

    if (transaction.is_transfer && transaction.transfer_group_id) {
      await prisma.transaction.updateMany({
        where: { transfer_group_id: transaction.transfer_group_id, deleted_at: null },
        data: { deleted_at: now },
      }) as unknown as never;
    } else {
      await prisma.transaction.update({
        where: { id },
        data: { deleted_at: now },
      });
    }

    return transaction;
  }

  async findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null> {
    const row = (await prisma.transaction.findFirst({
      where: { id },
      select: { id: true, deleted_at: true },
    })) as { id: string; deleted_at: Date | null } | null;
    return row;
  }

  async restore(id: string): Promise<Transaction> {
    return (await prisma.transaction.update({
      where: { id },
      data: { deleted_at: null },
    })) as unknown as Transaction;
  }

  // ─── Transferência entre contas (TransferService) ─────────────────────────

  async createTransfer(data: CreateTransferData & { company_id?: string }): Promise<TransferResult> {
    const originInstitutionId = data.financial_institution_id;
    const destinationInstitutionId = data.destination_institution_id;
    const destinationCenterId = data.destination_center_id;

    const amount = Number(data.amount);

    const { outflow, inflow } = await this.ensureTransferCategories();

    let mirrorCategoryId: string;
    if (String(data.category_id) === String(outflow.id)) {
      mirrorCategoryId = inflow.id;
    } else if (String(data.category_id) === String(inflow.id)) {
      mirrorCategoryId = outflow.id;
    } else {
      throw new Error('Categoria de transferência inválida.');
    }

    const [originInst, destinationInst] = await Promise.all([
      prisma.financialInstitution.findFirst({
        where: { id: originInstitutionId, deleted_at: null },
      }),
      prisma.financialInstitution.findFirst({
        where: { id: destinationInstitutionId, deleted_at: null },
      }),
    ]);
    if (!originInst) throw new Error('Conta de origem não encontrada.');
    if (!destinationInst) throw new Error('Conta de destino não encontrada.');

    const transferGroupId = randomUUID();
    const eventDate = parseLocalDate(data.event_date);
    const effectiveDate = parseLocalDate(data.effective_date);
    const status = data.status || 'COMPLETED';
    const baseDescription = String(data.description ?? '').trim();
    const parseFK = (val: unknown) => (val === '' || val === 'null' || !val ? null : (val as string));
    const centerId = parseFK(data.center_id);
    const mirrorCenterId = parseFK(destinationCenterId);
    const supplierId = parseFK(data.supplier_id);

    const mirrorDescription = baseDescription
      ? `${baseDescription} – Origem conta ${originInst.name}`
      : `Transferência – Origem conta ${originInst.name}`;

    const [origin, mirror] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          event_date: eventDate,
          effective_date: effectiveDate,
          description: baseDescription,
          amount,
          status,
          category_id: data.category_id,
          financial_institution_id: originInstitutionId,
          center_id: centerId,
          supplier_id: supplierId,
          is_transfer: true,
          transfer_group_id: transferGroupId,
        } as never,
        include: { category: true, financial_institution: true, supplier: true } as never,
      }),
      prisma.transaction.create({
        data: {
          event_date: eventDate,
          effective_date: effectiveDate,
          description: mirrorDescription,
          amount,
          status,
          category_id: mirrorCategoryId,
          financial_institution_id: destinationInstitutionId,
          center_id: mirrorCenterId,
          supplier_id: supplierId,
          is_transfer: true,
          transfer_group_id: transferGroupId,
        } as never,
        include: { category: true, financial_institution: true, supplier: true } as never,
      }),
    ]);

    return {
      transfer_group_id: transferGroupId,
      origin: origin as unknown as Transaction,
      mirror: mirror as unknown as Transaction,
    };
  }

  private async ensureTransferCategories() {
    const outflowName = 'Transferência entre Contas – Saída';
    const inflowName = 'Transferência entre Contas – Entrada';

    const findOrCreate = async (name: string, type: 'INCOME' | 'EXPENSE') => {
      const existing = await prisma.category.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, type, deleted_at: null },
      });
      if (existing) return existing;
      return prisma.category.create({
        data: { name, type, is_system: true } as never,
      });
    };

    const outflow = await findOrCreate(outflowName, 'EXPENSE');
    const inflow = await findOrCreate(inflowName, 'INCOME');
    return { outflow, inflow };
  }

  // ─── Parcelado (createInstallments) ───────────────────────────────────────

  async createInstallments(data: CreateInstallmentsData & { company_id?: string }): Promise<InstallmentsResult> {
    const parseFK = (val: unknown) => (val === '' || val === 'null' || !val ? null : val);
    const installmentAmount = parseAmount(data.installment_amount);
    const numInstallments = Number(data.num_installments);
    const totalAmount = parseAmount(data.total_amount);

    const firstPaymentDate = new Date(data.first_payment_date);
    const startDate = new Date(data.start_date);

    const installmentDates: Date[] = [];
    for (let i = 0; i < numInstallments; i++) {
      const date = new Date(firstPaymentDate);
      date.setUTCMonth(date.getUTCMonth() + i);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(firstPaymentDate.getUTCDate(), lastDay));
      installmentDates.push(date);
    }

    const transactionType = data.transaction_type || ('EXPENSE' as const);
    const label = transactionType === 'INCOME' ? 'Receita' : 'Parcela';

    const installmentGroupId = randomUUID();

    // `tx` (dentro de $transaction) não passa pela extensão multi-tenant —
    // company_id precisa ser injetado explicitamente em cada create.
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Contexto de empresa não identificado.');

    const installments = await prisma.$transaction(async (tx) => {
      const createdInstallments: any[] = [];
      const constantEventDate = new Date(startDate);
      const constantPurchaseDate = new Date(startDate);

      for (let index = 0; index < numInstallments; index++) {
        const installmentNumber = index + 1;
        const effectiveDate = installmentDates[index];
        const eventDate = parseLocalDate(constantEventDate);

        const invoiceMonth = effectiveDate.getUTCMonth() + 1;
        const invoiceYear = effectiveDate.getUTCFullYear();

        let invoiceId: string | null = null;
        const cardId = parseFK(data.card_id);

        if (cardId) {
          try {
            const invoice = await this.findOrCreateInvoice(tx, String(cardId), invoiceMonth, invoiceYear, companyId);
            invoiceId = invoice.id;
          } catch (error) {
            if ((error as Error).message.includes('Fatura de')) throw error;
            console.warn(
              `[DEBUG] Não foi possível vincular parcela à fatura: ${(error as Error).message}`,
            );
          }
        }

        const transaction = await tx.transaction.create({
          data: {
            company_id: companyId,
            installment_number: installmentNumber,
            total_installments: numInstallments,
            installment_group_id: installmentGroupId,
            amount: installmentAmount,
            description: data.description
              ? `${data.description} - ${label} ${installmentNumber}/${numInstallments}`
              : `${label} ${installmentNumber}/${numInstallments}`,
            event_date: eventDate,
            effective_date: effectiveDate,
            purchase_date: constantPurchaseDate,
            category_id: data.category_id,
            subcategory_id: parseFK(data.subcategory_id),
            financial_institution_id: data.institution_id,
            card_id: cardId,
            center_id: parseFK(data.center_id),
            supplier_id: parseFK(data.supplier_id),
            invoice_id: invoiceId,
            status: 'PENDING',
            payment_mode: 'PARCELADO',
          } as never,
          include: { category: true, financial_institution: true, supplier: true } as never,
        });

        createdInstallments.push(transaction);

        if (invoiceId) {
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { total_amount: { increment: installmentAmount } },
          });
        }
      }

      return createdInstallments;
    });

    const expectedTotal = installmentAmount * numInstallments;

    return {
      success: true,
      message: `${numInstallments} ${label.toLowerCase()}s de R$ ${installmentAmount.toFixed(2)} criadas com sucesso`,
      data: {
        num_installments: numInstallments,
        installment_amount: installmentAmount,
        total_amount: expectedTotal,
        installments: installments.map((inst: any) => ({
          id: inst.id,
          installment_number: inst.installment_number,
          amount: inst.amount,
          effective_date: inst.effective_date,
          description: inst.description,
          status: inst.status,
          invoice_id: inst.invoice_id,
        })),
      },
      validation: {
        sum_of_installments: expectedTotal,
        expected_total: totalAmount,
        matches: Math.abs(expectedTotal - totalAmount) <= 0.01,
      },
    };
  }

  // ─── Recorrência infinita (RecurringService) ──────────────────────────────

  async createRecurrence(data: CreateRecurrenceData & { company_id?: string }): Promise<RecurrenceResult> {
    const parseFK = (val: unknown) => (val === '' || val === 'null' || !val ? null : val);
    const parseAmountStr = (val: unknown): number => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const clean = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    const frequency = String(data.frequency || 'MONTHLY') as RecurringFrequency;
    const amount = parseAmountStr(data.amount);
    const startDate = parseLocalDate(data.start_date);
    const firstPaymentDate = parseLocalDate(data.first_payment_date);
    const transactionType = data.transaction_type === 'INCOME' ? 'INCOME' : 'EXPENSE';

    const config = await prisma.recurringConfig.create({
      data: {
        description: data.description || (transactionType === 'INCOME' ? 'Receita Recorrente' : 'Despesa Recorrente'),
        amount,
        frequency,
        category_id: data.category_id,
        subcategory_id: parseFK(data.subcategory_id),
        financial_institution_id: data.institution_id as string,
        card_id: parseFK(data.card_id),
        center_id: parseFK(data.center_id),
        supplier_id: parseFK(data.supplier_id),
        start_date: startDate,
        end_date: null,
        is_active: true,
      } as never,
    });

    const generated = await this.generateForConfig(config, firstPaymentDate);

    return {
      success: true,
      message: `${generated} lançamentos recorrentes criados (janela de ${YEARS_AHEAD} anos)`,
      data: {
        recurring_group_id: config.id,
        frequency,
        generated,
      },
    };
  }

  private async generateForConfig(config: any, firstPaymentDate?: Date): Promise<number> {
    const today = parseLocalDate(new Date());
    const limit = new Date(Date.UTC(today.getUTCFullYear() + YEARS_AHEAD, today.getUTCMonth(), today.getUTCDate()));

    let baseDate = firstPaymentDate;
    if (!baseDate) {
      const first = (await prisma.transaction.findFirst({
        where: { recurring_group_id: config.id, occurrence_number: 1 },
        select: { effective_date: true },
      })) as unknown as { effective_date: Date } | null;
      baseDate = first ? parseLocalDate(first.effective_date) : parseLocalDate(config.start_date);
    }

    const last = (await prisma.transaction.findFirst({
      where: { recurring_group_id: config.id },
      orderBy: { occurrence_number: 'desc' },
      select: { occurrence_number: true },
    })) as unknown as { occurrence_number: number | null } | null;
    const startIndex = last?.occurrence_number ?? 0;

    const frequency = config.frequency as RecurringFrequency;
    const rows: unknown[] = [];
    const startDateForEvent = parseLocalDate(config.start_date);

    for (let index = startIndex; ; index++) {
      const effectiveDate = computeOccurrenceDate(baseDate, index, frequency);
      if (effectiveDate > limit) break;
      const occurrenceNumber = index + 1;

      rows.push({
        event_date: startDateForEvent,
        effective_date: effectiveDate,
        description: config.description,
        amount: config.amount,
        status: 'PENDING',
        category_id: config.category_id,
        subcategory_id: config.subcategory_id,
        financial_institution_id: config.financial_institution_id,
        card_id: config.card_id,
        center_id: config.center_id,
        supplier_id: config.supplier_id,
        is_recurring: true,
        recurring_group_id: config.id,
        recurring_frequency: frequency,
        occurrence_number: occurrenceNumber,
        payment_mode: 'RECORRENTE',
        company_id: config.company_id,
      });

      if (rows.length > 2000) break;
    }

    if (rows.length === 0) return 0;

    const result = await prisma.transaction.createMany({
      data: rows as never,
      skipDuplicates: true,
    });

    await prisma.recurringConfig.update({
      where: { id: config.id },
      data: {
        generated_occurrences: { increment: result.count },
        next_generation_date: limit,
      },
    });

    return result.count;
  }

  // ─── Grupos relacionados ───────────────────────────────────────────────────

  async getRelated(id: string): Promise<RelatedTransactionsResult> {
    const transaction = (await prisma.transaction.findUnique({
      where: { id, deleted_at: null },
      include: {
        category: true,
        financial_institution: true,
        supplier: true,
        child_transactions: {
          where: { deleted_at: null },
          orderBy: { installment_number: 'asc' },
        },
      },
    })) as unknown as any;

    if (!transaction) throw new NotFoundError('Lançamento não encontrado');

    if (transaction.parent_transaction_id) {
      const parent = (await prisma.transaction.findUnique({
        where: { id: transaction.parent_transaction_id },
        include: {
          child_transactions: {
            where: { deleted_at: null },
            orderBy: { installment_number: 'asc' },
          },
        },
      })) as unknown as any;

      return {
        parent: {
          id: parent?.id ?? null,
          type: parent?.payment_mode ?? null,
          total_amount: parent?.amount != null ? Number(parent.amount) : null,
          total_installments: parent?.total_installments ?? null,
        },
        related_transactions: (parent?.child_transactions ?? []) as unknown as Transaction[],
      };
    }

    if (transaction.recurring_group_id) {
      const occurrences = (await prisma.transaction.findMany({
        where: {
          recurring_group_id: transaction.recurring_group_id,
          deleted_at: null,
        },
        orderBy: { occurrence_number: 'asc' },
      })) as unknown as Transaction[];

      const config = (await prisma.recurringConfig.findUnique({
        where: { id: transaction.recurring_group_id },
      })) as unknown as { total_occurrences: number | null } | null;

      return {
        parent: {
          id: transaction.recurring_group_id,
          type: 'RECORRENTE',
          total_amount: transaction.amount != null ? Number(transaction.amount) : null,
          total_installments: config?.total_occurrences ?? null,
        },
        related_transactions: occurrences,
      };
    }

    if (transaction.child_transactions && transaction.child_transactions.length > 0) {
      return {
        parent: {
          id: transaction.id,
          type: transaction.payment_mode,
          total_amount: transaction.amount != null ? Number(transaction.amount) : null,
          total_installments: transaction.total_installments ?? null,
        },
        related_transactions: transaction.child_transactions as unknown as Transaction[],
      };
    }

    return {
      parent: null,
      related_transactions: [],
    };
  }

  // ─── Relatórios / agregações (Módulo 11 — Dashboard) ──────────────────────

  /** Converte os filtros do botão Filtro (Tarefa 5.1) num `where` do Prisma. */
  private buildEntityFilterWhere(filters: TransactionEntityFilters = {}): Record<string, { in: string[] } | { OR: { description: { contains: string; mode: 'insensitive' } }[] }> {
    const where: Record<string, any> = {};
    for (const field of ['category_id', 'subcategory_id', 'financial_institution_id', 'card_id', 'center_id', 'supplier_id'] as const) {
      if (filters[field]?.length) where[field] = { in: filters[field] };
    }
    if (filters.description?.length) {
      where.OR = filters.description.map((d) => ({ description: { contains: d, mode: 'insensitive' as const } }));
    }
    return where;
  }

  async getMonthlySummary(year: number, filters: TransactionEntityFilters = {}): Promise<MonthlySummary> {
    const [result] = await this.getMonthlySummaryMulti([year], filters);
    return result;
  }

  async getMonthlySummaryMulti(years: number[], filters: TransactionEntityFilters = {}): Promise<MonthlySummaryMultiResult> {
    const uniqueYears = Array.from(new Set(years.map((y) => Number(y)).filter((y) => !Number.isNaN(y)))).sort((a, b) => a - b);
    if (uniqueYears.length === 0) return [];

    const startDate = new Date(Date.UTC(uniqueYears[0], 0, 1));
    const endDate = new Date(Date.UTC(uniqueYears[uniqueYears.length - 1], 11, 31, 23, 59, 59, 999));

    const transactions = (await prisma.transaction.findMany({
      where: {
        deleted_at: null,
        NOT: { is_transfer: true },
        event_date: { gte: startDate, lte: endDate },
        ...this.buildEntityFilterWhere(filters),
      },
      select: {
        event_date: true,
        amount: true,
        category: { select: { type: true } },
      },
    })) as unknown as Array<{ event_date: Date; amount: unknown; category: { type: string } | null }>;

    const byYear = new Map<number, { month: number; income: number; expense: number }[]>(
      uniqueYears.map((y) => [y, Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }))]),
    );

    for (const t of transactions) {
      const transactionYear = t.event_date.getUTCFullYear();
      const months = byYear.get(transactionYear);
      if (!months) continue;
      const monthIndex = t.event_date.getUTCMonth();
      const amount = Number(t.amount);
      if (t.category?.type === 'INCOME') months[monthIndex].income += amount;
      else if (t.category?.type === 'EXPENSE') months[monthIndex].expense += amount;
    }

    return uniqueYears.map((y) => ({ year: y, months: byYear.get(y)! }));
  }

  async getAvailableYears(): Promise<AvailableYearsResult> {
    const transactions = (await prisma.transaction.findMany({
      where: { deleted_at: null, NOT: { is_transfer: true } },
      select: { event_date: true },
    })) as unknown as Array<{ event_date: Date }>;

    const years = Array.from(new Set(transactions.map((t) => t.event_date.getUTCFullYear())));
    years.sort((a, b) => b - a);

    return { years };
  }

  async getExpenseByCategory(startDate: Date, endDate: Date, filters: TransactionEntityFilters = {}): Promise<ExpenseByCategoryResult> {
    const baseWhere = {
      deleted_at: null,
      NOT: { is_transfer: true },
      event_date: { gte: startDate, lte: endDate },
      ...this.buildEntityFilterWhere(filters),
    };

    const [incomeResult, categoryGroups, expenseTransactions] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...baseWhere, category: { type: 'INCOME' } },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['category_id'],
        where: { ...baseWhere, category: { type: 'EXPENSE' } },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { ...baseWhere, category: { type: 'EXPENSE' } },
        select: { category_id: true, amount: true, event_date: true },
      }),
    ]);

    const totalIncome = Number((incomeResult as any)._sum?.amount ?? 0);

    const categoryIds = (categoryGroups as any[]).map((g) => g.category_id);
    const categoryNames = categoryIds.length > 0
      ? ((await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })) as unknown as Array<{ id: string; name: string }>)
      : [];
    const nameById = new Map(categoryNames.map((c) => [c.id, c.name]));

    const byYearByCategory = new Map<string, Map<number, number>>();
    for (const t of expenseTransactions as any[]) {
      const year = t.event_date.getUTCFullYear();
      const perYear = byYearByCategory.get(t.category_id) ?? new Map<number, number>();
      perYear.set(year, (perYear.get(year) ?? 0) + Number(t.amount));
      byYearByCategory.set(t.category_id, perYear);
    }

    const categories = (categoryGroups as any[])
      .map((g) => {
        const perYear = byYearByCategory.get(g.category_id);
        const byYear = perYear
          ? Array.from(perYear.entries())
              .map(([year, value]) => ({ year, value }))
              .sort((a, b) => a.year - b.year)
          : [];

        return {
          categoryId: g.category_id,
          name: nameById.get(g.category_id) ?? 'Sem categoria',
          value: Number(g._sum?.amount ?? 0),
          byYear: byYear.length > 1 ? byYear : undefined,
        };
      })
      .sort((a, b) => b.value - a.value);

    return { totalIncome, categories };
  }

  async getSubcategoryBreakdown(categoryId: string, startDate: Date, endDate: Date, filters: TransactionEntityFilters = {}): Promise<SubcategoryBreakdownResult> {
    const category = (await prisma.category.findFirst({
      where: { id: categoryId, deleted_at: null },
      select: { id: true, name: true },
    })) as unknown as { id: string; name: string } | null;
    if (!category) throw new NotFoundError('Categoria não encontrada');

    const baseWhere = {
      deleted_at: null,
      NOT: { is_transfer: true },
      event_date: { gte: startDate, lte: endDate },
      ...this.buildEntityFilterWhere(filters),
      // A subcategoria pedida nunca pode ser sobrescrita por um category_id do filtro global.
      category_id: categoryId,
    };

    const [subcategoryGroups, transactions] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['subcategory_id'],
        where: baseWhere,
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: baseWhere,
        select: { subcategory_id: true, amount: true, event_date: true },
      }),
    ]);

    const subcategoryIds = (subcategoryGroups as any[]).map((g) => g.subcategory_id).filter((id): id is string => id !== null);
    const subcategoryNames = subcategoryIds.length > 0
      ? ((await prisma.subcategory.findMany({ where: { id: { in: subcategoryIds } }, select: { id: true, name: true } })) as unknown as Array<{ id: string; name: string }>)
      : [];
    const nameById = new Map(subcategoryNames.map((s) => [s.id, s.name]));

    const byYearBySubcategory = new Map<string, Map<number, number>>();
    for (const t of transactions as any[]) {
      const key = t.subcategory_id ?? 'none';
      const year = t.event_date.getUTCFullYear();
      const perYear = byYearBySubcategory.get(key) ?? new Map<number, number>();
      perYear.set(year, (perYear.get(year) ?? 0) + Number(t.amount));
      byYearBySubcategory.set(key, perYear);
    }

    const subcategories = (subcategoryGroups as any[])
      .map((g) => {
        const perYear = byYearBySubcategory.get(g.subcategory_id ?? 'none');
        const byYear = perYear
          ? Array.from(perYear.entries())
              .map(([year, value]) => ({ year, value }))
              .sort((a, b) => a.year - b.year)
          : [];

        return {
          subcategoryId: g.subcategory_id,
          name: g.subcategory_id ? (nameById.get(g.subcategory_id) ?? 'Sem subcategoria') : 'Sem subcategoria',
          value: Number(g._sum?.amount ?? 0),
          byYear: byYear.length > 1 ? byYear : undefined,
        };
      })
      .sort((a, b) => b.value - a.value);

    const total = subcategories.reduce((sum, s) => sum + s.value, 0);

    return { categoryId: category.id, categoryName: category.name, total, subcategories };
  }

  // ─── Anexos do lançamento (DocumentService) ────────────────────────────────

  async listDocuments(transactionId: string): Promise<TransactionDocument[]> {
    const documents = (await prisma.document.findMany({
      where: { transaction_id: transactionId, deleted_at: null },
      orderBy: { created_at: 'asc' },
    })) as unknown as TransactionDocument[];
    return documents;
  }

  async countDocuments(transactionId: string): Promise<number> {
    return prisma.document.count({ where: { transaction_id: transactionId, deleted_at: null } });
  }

  async createDocuments(
    transactionId: string,
    documents: Array<{ url: string; mimetype: string; description: string; createdBy: string | null }>,
  ): Promise<TransactionDocument[]> {
    // `company_id` é passado explicitamente (não depende só da extensão de
    // tenant) — este create já rodou fora do contexto de AsyncLocalStorage em
    // ambiente de dev (Turbopack), causando "Argument `company` is missing.".
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId },
      select: { company_id: true },
    });
    if (!transaction) throw new Error('Lançamento não encontrado ao criar anexo.');

    const created: TransactionDocument[] = [];
    for (const doc of documents) {
      const record = (await prisma.document.create({
        data: {
          company_id: transaction.company_id,
          transaction_id: transactionId,
          file_path: doc.url,
          file_type: doc.mimetype,
          description: doc.description,
          type: 'OTHER',
          created_by: doc.createdBy,
        } as never,
      })) as unknown as TransactionDocument;
      created.push(record);
    }
    return created;
  }

  async removeDocuments(transactionId: string, documentIds: string[]): Promise<void> {
    if (!documentIds || documentIds.length === 0) return;
    await prisma.document.updateMany({
      where: { id: { in: documentIds }, transaction_id: transactionId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
  }
}