import prisma from '@/infra/database/prisma';
import type { FinancialInstitutionsRepository } from '@/core/repositories/financial-institutions-repository';
import type {
  BalanceSummaryItem,
  CreateFinancialInstitutionData,
  FinancialInstitution,
  ListFinancialInstitutionsParams,
  PaginatedFinancialInstitutions,
  UpdateFinancialInstitutionData,
} from '@/core/entities/financial-institution';
import { ConflictError, NotFoundError } from '@/core/errors/domain-errors';

/**
 * Implementação Prisma de {@link FinancialInstitutionsRepository}.
 * Porte fiel de api-nairim-v2/src/services/FinancialIntitucion.ts.
 *
 * O scoping por empresa é automático (extensão multi-tenant: `FinancialInstitution`
 * está em TENANT_MODELS). `getBalanceSummary` usa `groupBy` em `Transaction`
 * comparando `category.type` — idem ao backend.
 *
 * Camada: infra.
 */

type Institution = FinancialInstitution;

const DIRECT_SORTABLE_FIELDS = ['name', 'bank_number', 'agency_number', 'account_number', 'created_at', 'is_active'];

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeSortDirection(direction: string): 'asc' | 'desc' {
  return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function buildWhere(filters: Record<string, unknown>, includeInactive: boolean): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!includeInactive) where.deleted_at = null;

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'name') {
      where[key] = String(value);
    } else if (['bank_number', 'agency_number', 'account_number'].includes(key)) {
      where[key] = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'is_active') {
      where[key] = value === 'true' || value === true;
    }
  });
  return where;
}

function buildOrderBy(sortOptions: Record<string, string>): Record<string, string>[] {
  const orderBy: Record<string, string>[] = [];
  Object.entries(sortOptions).forEach(([field, direction]) => {
    if (DIRECT_SORTABLE_FIELDS.includes(field)) orderBy.push({ [field]: normalizeSortDirection(direction) });
  });
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
  return orderBy;
}

function filterBySearch(institutions: Institution[], searchTerm: string): Institution[] {
  if (!searchTerm.trim()) return institutions;
  const normalizedSearchTerm = normalizeText(searchTerm);
  return institutions.filter((inst) => {
    const fieldsToSearch = [inst.name, inst.bank_number, inst.agency_number, inst.account_number].filter(Boolean).join(' ');
    return normalizeText(fieldsToSearch).includes(normalizedSearchTerm);
  });
}

function sortByString(items: Institution[], field: string, direction: 'asc' | 'desc'): Institution[] {
  return [...items].sort((a, b) => {
    const strA = normalizeText(String(a[field] ?? ''));
    const strB = normalizeText(String(b[field] ?? ''));
    return direction === 'asc' ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' }) : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
  });
}

export class PrismaFinancialInstitutionsRepository implements FinancialInstitutionsRepository {
  async list(params: ListFinancialInstitutionsParams): Promise<PaginatedFinancialInstitutions> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters, params.includeInactive);

    const sortEntries = Object.entries(params.sortOptions);
    let institutions: Institution[] = [];
    let total = 0;

    if (params.search?.trim()) {
      // Busca em memória: igual ao backend.
      const allInstitutions = (await prisma.financialInstitution.findMany({ where: where as never })) as Institution[];
      let filtered = filterBySearch(allInstitutions, params.search ?? '');
      total = filtered.length;

      if (sortEntries.length > 0) {
        const field = sortEntries[0][0];
        const direction = normalizeSortDirection(sortEntries[0][1]);
        filtered = sortByString(filtered, field, direction);
      } else {
        filtered = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      institutions = filtered.slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.financialInstitution.findMany({ where: where as never, skip, take, orderBy: buildOrderBy(params.sortOptions) as never }),
        prisma.financialInstitution.count({ where: where as never }),
      ]);
      institutions = data as Institution[];
      total = count;
    }

    return { data: institutions as FinancialInstitution[], count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(): Promise<Record<string, unknown>> {
    const institutions = await prisma.financialInstitution.findMany({
      where: { deleted_at: null },
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    const uniqueNames = Array.from(new Set(institutions.map((i) => i.name)));
    const nameOptions = uniqueNames.map((name) => ({ label: name, value: name }));

    return {
      filters: [
        {
          field: 'name',
          type: 'select',
          label: 'Nome da Instituição',
          values: nameOptions,
          searchable: true,
        },
        {
          field: 'is_active',
          type: 'select',
          label: 'Status',
          values: [
            { label: 'Ativo', value: 'true' },
            { label: 'Inativo', value: 'false' },
          ],
        },
      ],
      defaultSort: 'created_at:desc',
      searchFields: ['name', 'bank_number', 'agency_number', 'account_number'],
    };
  }

  async findById(id: string): Promise<FinancialInstitution | null> {
    const institution = await prisma.financialInstitution.findFirst({ where: { id, deleted_at: null } });
    return (institution as FinancialInstitution) ?? null;
  }

  async create(data: CreateFinancialInstitutionData): Promise<FinancialInstitution> {
    // `company_id` é injetado pela extensão multi-tenant a partir do contexto.
    const created = await prisma.financialInstitution.create({
      data: {
        name: data.name,
        bank_number: data.bank_number || null,
        agency_number: data.agency_number || null,
        account_number: data.account_number || null,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      } as never,
    });
    return created as FinancialInstitution;
  }

  async update(id: string, data: UpdateFinancialInstitutionData): Promise<FinancialInstitution> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.bank_number !== undefined) updateData.bank_number = data.bank_number;
    if (data.agency_number !== undefined) updateData.agency_number = data.agency_number;
    if (data.account_number !== undefined) updateData.account_number = data.account_number;
    if (data.is_active !== undefined) updateData.is_active = Boolean(data.is_active);

    const updated = await prisma.financialInstitution.update({ where: { id }, data: updateData });
    return updated as FinancialInstitution;
  }

  async softDelete(id: string): Promise<FinancialInstitution> {
    const institution = await prisma.financialInstitution.findFirst({ where: { id, deleted_at: null } });
    if (!institution) throw new NotFoundError('Instituição não encontrada ou já excluída');

    const hasTransactions = await prisma.transaction.findFirst({
      where: { financial_institution_id: id, deleted_at: null },
    });
    if (hasTransactions) {
      throw new ConflictError('Não é possível excluir a instituição financeira pois existem lançamentos relacionados.');
    }

    const updated = await prisma.financialInstitution.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return updated as FinancialInstitution;
  }

  async findDeletionState(id: string): Promise<{ deleted_at: Date | null } | null> {
    const institution = await prisma.financialInstitution.findFirst({ where: { id }, select: { deleted_at: true } });
    return institution ?? null;
  }

  async restore(id: string): Promise<FinancialInstitution> {
    const institution = await prisma.financialInstitution.findFirst({ where: { id } });
    if (!institution) throw new NotFoundError('Instituição não encontrada');
    if (!institution.deleted_at) throw new NotFoundError('Instituição não está excluída');

    const updated = await prisma.financialInstitution.update({
      where: { id },
      data: { deleted_at: null },
    });
    return updated as FinancialInstitution;
  }

  async quickCreate(data: { name: string }): Promise<FinancialInstitution> {
    const name = String(data.name ?? '').trim();
    if (!name) throw new Error('Nome é obrigatório');

    const existing = await prisma.financialInstitution.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, deleted_at: null },
    });
    if (existing) return existing as FinancialInstitution;

    const created = await prisma.financialInstitution.create({
      data: { name, is_active: true } as never,
    });
    return created as FinancialInstitution;
  }

  async getBalanceSummary(): Promise<BalanceSummaryItem[]> {
    const now = new Date();

    const institutions = await prisma.financialInstitution.findMany({
      where: { deleted_at: null, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const [incomeGroups, expenseGroups] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['financial_institution_id'],
        where: {
          deleted_at: null,
          status: 'COMPLETED',
          effective_date: { lte: now },
          category: { type: 'INCOME' },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['financial_institution_id'],
        where: {
          deleted_at: null,
          status: 'COMPLETED',
          effective_date: { lte: now },
          category: { type: 'EXPENSE' },
        },
        _sum: { amount: true },
      }),
    ]);

    const incomeByInstitution = new Map(incomeGroups.map((g) => [g.financial_institution_id, Number(g._sum.amount ?? 0)]));
    const expenseByInstitution = new Map(expenseGroups.map((g) => [g.financial_institution_id, Number(g._sum.amount ?? 0)]));

    return institutions.map((institution) => ({
      institutionId: institution.id,
      name: institution.name,
      balance: (incomeByInstitution.get(institution.id) ?? 0) - (expenseByInstitution.get(institution.id) ?? 0),
    }));
  }
}