import prisma from '@/infra/database/prisma';
import type { CentersRepository } from '@/core/repositories/financial-centers-repository';
import type {
  Center,
  CreateCenterData,
  ListCentersParams,
  PaginatedCenters,
  UpdateCenterData,
} from '@/core/entities/financial-center';
import type { TransactionType } from '@/core/entities/category';
import { ConflictError, NotFoundError } from '@/core/errors/domain-errors';

/**
 * Implementação Prisma de {@link CentersRepository}.
 * Porte fiel de api-nairim-v2/src/services/CenterService.ts.
 *
 * Tenant: o `getCenters`/`getCenterById` do Express já recebia `company_id`
 * (leitura escopada). `Center` está em TENANT_MODELS e a extensão injeta
 * `company_id` nas leituras — comportamento idêntico.
 *
 * DIVERGÊNCIA DOCUMENTADA no delete: o backend lança "Nao e possivel excluir o
 * centro pois existem lancamentos relacionados." (sem acentos) e o controller
 * testava `includes('lançamentos')` — nunca casava, virando 500. Aqui lançamos
 * `ConflictError` (409) normalizado com acentuação.
 *
 * Camada: infra.
 */

type CenterRow = Center & { deleted_at: Date | null };

const DIRECT_SORTABLE_FIELDS = ['name', 'type', 'is_active', 'created_at'];

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeSortDirection(direction: string): 'asc' | 'desc' {
  return String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function buildWhere(filters: Record<string, unknown>, includeInactive: boolean): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!includeInactive) where.deleted_at = null;

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'name') {
      where[key] = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'type') {
      where[key] = value;
    } else if (key === 'is_active') {
      where[key] = value === 'true' || value === true;
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

function filterCentersBySearch(centers: CenterRow[], searchTerm: string): CenterRow[] {
  if (!searchTerm.trim()) return centers;
  const normalizedSearch = normalizeText(searchTerm);

  return centers.filter((center) => {
    const typePt = center.type === 'INCOME' ? 'receita' : center.type === 'EXPENSE' ? 'despesa' : '';
    const statusPt = center.is_active ? 'ativo' : 'inativo';
    const fieldsToSearch = [center.name, typePt, statusPt].join(' ');
    return normalizeText(fieldsToSearch).includes(normalizedSearch);
  });
}

function sortCenters(centers: CenterRow[], sortOptions: Record<string, string>): CenterRow[] {
  const entries = Object.entries(sortOptions);
  if (entries.length === 0) {
    return [...centers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  const field = entries[0][0];
  const direction = normalizeSortDirection(entries[0][1]);

  if (field === 'is_active') {
    return [...centers].sort((a, b) => {
      return direction === 'asc'
        ? Number(a.is_active) - Number(b.is_active)
        : Number(b.is_active) - Number(a.is_active);
    });
  }

  return [...centers].sort((a, b) => {
    const strA = String((a as unknown as Record<string, unknown>)[field] || '');
    const strB = String((b as unknown as Record<string, unknown>)[field] || '');
    return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

export class PrismaFinancialCentersRepository implements CentersRepository {
  async list(params: ListCentersParams): Promise<PaginatedCenters> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters, params.includeInactive);

    let centers: CenterRow[] = [];
    let total = 0;

    if (params.search?.trim()) {
      const allCenters = (await prisma.center.findMany({ where: where as never })) as CenterRow[];
      const filtered = filterCentersBySearch(allCenters, params.search ?? '');
      total = filtered.length;
      centers = sortCenters(filtered, params.sortOptions).slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.center.findMany({ where: where as never, skip, take, orderBy: buildOrderBy(params.sortOptions) as never }),
        prisma.center.count({ where: where as never }),
      ]);
      centers = data as CenterRow[];
      total = count;
    }

    return { data: centers, count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(): Promise<Record<string, unknown>> {
    const centers = await prisma.center.findMany({
      where: { deleted_at: null },
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    const uniqueNames = Array.from(new Set(centers.map((c) => c.name)));
    const nameOptions = uniqueNames.map((name) => ({ label: name, value: name }));

    return {
      filters: [
        { field: 'name', type: 'select', label: 'Nome do Centro', values: nameOptions, searchable: true },
        {
          field: 'is_active',
          type: 'select',
          label: 'Status',
          values: [
            { value: 'true', label: 'Ativo' },
            { value: 'false', label: 'Inativo' },
          ],
        },
      ],
      defaultSort: 'created_at:desc',
      searchFields: ['name'],
    };
  }

  async findById(id: string): Promise<Center | null> {
    const center = await prisma.center.findFirst({ where: { id, deleted_at: null } });
    return (center as Center) ?? null;
  }

  async create(data: CreateCenterData): Promise<Center> {
    // `company_id` é injetado pela extensão multi-tenant a partir do contexto.
    const created = await prisma.center.create({
      data: {
        name: data.name,
        type: data.type,
        is_active: data.is_active ?? true,
      } as never,
    });
    return created as Center;
  }

  async update(id: string, data: UpdateCenterData): Promise<Center> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const updated = await prisma.center.update({ where: { id }, data: updateData });
    return updated as Center;
  }

  async softDelete(id: string): Promise<Center> {
    const center = await prisma.center.findFirst({ where: { id, deleted_at: null } });
    if (!center) throw new NotFoundError('Centro não encontrado ou já excluído');

    const hasTransactions = await prisma.transaction.findFirst({
      where: { center_id: id, deleted_at: null },
    });
    if (hasTransactions) {
      throw new ConflictError('Não é possível excluir o centro de custo pois existem lançamentos relacionados.');
    }

    const updated = await prisma.center.update({ where: { id }, data: { deleted_at: new Date() } });
    return updated as Center;
  }

  async findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null> {
    const center = await prisma.center.findFirst({ where: { id }, select: { id: true, deleted_at: true } });
    return center ?? null;
  }

  async restore(id: string): Promise<Center> {
    const updated = await prisma.center.update({ where: { id }, data: { deleted_at: null } });
    return updated as Center;
  }

  async quickCreate(data: { name: string; type: TransactionType }): Promise<Center> {
    const name = String(data.name ?? '').trim();
    if (!name) throw new Error('Nome é obrigatório');
    if (!data.type) throw new Error('Tipo é obrigatório');

    const existing = await prisma.center.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, type: data.type, deleted_at: null },
    });
    if (existing) return existing as Center;

    return (await prisma.center.create({
      data: { name, type: data.type, is_active: true } as never,
    })) as Center;
  }
}