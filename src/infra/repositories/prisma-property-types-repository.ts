import prisma from '@/infra/database/prisma';
import type { PropertyTypesRepository } from '@/core/repositories/property-types-repository';
import type {
  CreatePropertyTypeData,
  ListPropertyTypesParams,
  PaginatedPropertyTypes,
  PropertyType,
  UpdatePropertyTypeData,
} from '@/core/entities/property-type';

/**
 * Implementação Prisma de {@link PropertyTypesRepository}.
 * Porte de api-nairim-v2/src/services/PropertyTypeService.ts.
 * Tenant-scoped: `PropertyType` está em TENANT_MODELS.
 *
 * Camada: infra.
 */

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[çÇ]/g, 'c').replace(/[ñÑ]/g, 'n').toLowerCase().trim();
}

function normalizeDirection(direction: string): 'asc' | 'desc' {
  return String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function buildDateCondition(value: unknown): Record<string, Date> {
  if (typeof value === 'object' && value && 'from' in value && 'to' in value) {
    const range = value as { from: string; to: string };
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) return { gte: fromDate, lte: toDate };
  } else if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      return { gte: startOfDay, lte: endOfDay };
    }
  }
  return {};
}

function buildWhere(filters: Record<string, unknown>, includeInactive: boolean): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!includeInactive) where.deleted_at = null;
  const conditions: Record<string, unknown> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'description') conditions[key] = { contains: String(value), mode: 'insensitive' };
    else if (key === 'created_at') conditions[key] = buildDateCondition(value);
  });
  if (Object.keys(conditions).length > 0) where.AND = [conditions];
  return where;
}

export class PrismaPropertyTypesRepository implements PropertyTypesRepository {
  async list(params: ListPropertyTypesParams): Promise<PaginatedPropertyTypes> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters, params.includeInactive);

    const sortEntries = Object.entries(params.sortOptions);
    const sortField = sortEntries[0]?.[0];
    const sortDirection = sortEntries[0] ? normalizeDirection(sortEntries[0][1]) : 'asc';

    let types: PropertyType[] = [];
    let total = 0;

    if (params.search?.trim()) {
      const all = await prisma.propertyType.findMany({
        where: where as never,
        select: { id: true, description: true, created_at: true, updated_at: true, deleted_at: true },
      });
      const normalizedSearch = normalizeText(params.search);
      const filtered = all.filter((t) => normalizeText(t.description).includes(normalizedSearch));
      total = filtered.length;

      const sorted = sortField
        ? [...filtered].sort((a, b) => {
            const strA = normalizeText(String((a as Record<string, unknown>)[sortField] ?? ''));
            const strB = normalizeText(String((b as Record<string, unknown>)[sortField] ?? ''));
            return sortDirection === 'asc' ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' }) : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
          })
        : [...filtered].sort((a, b) => normalizeText(a.description).localeCompare(normalizeText(b.description), 'pt-BR', { sensitivity: 'base' }));

      types = sorted.slice(skip, skip + take);
    } else {
      const orderBy = sortField && ['description', 'created_at', 'updated_at'].includes(sortField)
        ? [{ [sortField]: sortDirection }]
        : [{ description: 'asc' }];

      const [data, count] = await Promise.all([
        prisma.propertyType.findMany({ where: where as never, skip, take, orderBy: orderBy as never }),
        prisma.propertyType.count({ where: where as never }),
      ]);
      types = data;
      total = count;
    }

    return { data: types, count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = { deleted_at: null };
    if (filters.description) where.description = { contains: String(filters.description), mode: 'insensitive' };

    const [types, dateRange] = await Promise.all([
      prisma.propertyType.findMany({ where: where as never, select: { description: true }, distinct: ['description'], orderBy: { description: 'asc' } }),
      prisma.propertyType.aggregate({ where: where as never, _min: { created_at: true }, _max: { created_at: true } }),
    ]);

    return {
      filters: [
        { field: 'description', type: 'string', label: 'Descrição', description: 'Tipo de propriedade', values: types.filter((t) => t.description).map((t) => t.description.trim()), searchable: true, autocomplete: true },
        { field: 'created_at', type: 'date', label: 'Data de Criação', description: 'Data de cadastro no sistema', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true },
      ],
      operators: { string: ['contains', 'equals', 'startsWith', 'endsWith'], date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'] },
      defaultSort: 'description:asc',
      searchFields: ['description'],
    };
  }

  async findById(id: string): Promise<PropertyType | null> {
    return prisma.propertyType.findFirst({ where: { id, deleted_at: null } });
  }

  async descriptionExists(description: string): Promise<boolean> {
    return !!(await prisma.propertyType.findFirst({ where: { description, deleted_at: null }, select: { id: true } }));
  }
  async descriptionExistsExcept(description: string, exceptId: string): Promise<boolean> {
    return !!(await prisma.propertyType.findFirst({ where: { description, deleted_at: null, NOT: { id: exceptId } }, select: { id: true } }));
  }

  async create(data: CreatePropertyTypeData): Promise<PropertyType> {
    // `company_id` é injetado pela extensão multi-tenant a partir do contexto.
    return prisma.propertyType.create({ data: { description: data.description } as never });
  }

  async update(id: string, data: UpdatePropertyTypeData): Promise<PropertyType> {
    return prisma.propertyType.update({ where: { id }, data: { description: data.description } });
  }

  async softDelete(id: string): Promise<PropertyType | null> {
    const type = await prisma.propertyType.findFirst({ where: { id, deleted_at: null } });
    if (!type) return null;

    await prisma.$transaction(async (tx: any) => {
      await tx.propertyType.update({ where: { id }, data: { deleted_at: new Date() } });
      await tx.property.updateMany({ where: { type_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
      await tx.lease.updateMany({ where: { type_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
    });
    return type;
  }

  async findDeletionState(id: string): Promise<{ description: string; deleted_at: Date | null } | null> {
    return prisma.propertyType.findFirst({ where: { id }, select: { description: true, deleted_at: true } });
  }

  async restore(id: string): Promise<PropertyType> {
    return prisma.propertyType.update({ where: { id }, data: { deleted_at: null } });
  }
}
