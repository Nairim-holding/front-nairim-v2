import prisma from '@/infra/database/prisma';
import type { UserGroupsRepository } from '@/core/repositories/user-groups-repository';
import type {
  CloneUserGroupResult,
  CreateUserGroupData,
  GetUserGroupsParams,
  PaginatedUserGroups,
  UpdateUserGroupData,
  UserGroup,
} from '@/core/entities/user-group';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';

/**
 * Implementação Prisma de {@link UserGroupsRepository}.
 * Porte de api-nairim-v2/src/services/UserGroupService.ts.
 * Tenant-scoped: `UserGroup` está em TENANT_MODELS.
 *
 * Camada: infra.
 */

const AUTHOR_SELECT = { select: { id: true, name: true } } as const;

const USER_GROUP_SELECT = {
  id: true,
  description: true,
  created_by: true,
  created_at: true,
  updated_by: true,
  updated_at: true,
  deleted_at: true,
  creator: AUTHOR_SELECT,
  updater: AUTHOR_SELECT,
} as const;

/** Remove acentos/diacríticos para busca/ordenação em memória, ignorando acento. */
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ñÑ]/g, 'n')
    .toLowerCase()
    .trim();
}

function normalizeSortDirection(direction: string): 'asc' | 'desc' {
  return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function companyId(): string {
  const id = getCurrentCompanyId();
  if (!id) throw new Error('Company context not found');
  return id;
}

export class PrismaUserGroupsRepository implements UserGroupsRepository {
  async list(params: GetUserGroupsParams): Promise<PaginatedUserGroups> {
    const { limit = 150, page = 1, search = '', filters = {}, sortOptions = {}, includeInactive = false } = params;

    const take = Math.max(1, Math.min(limit, 150));
    const skip = (Math.max(1, page) - 1) * take;

    const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);

    const sortEntries = Object.entries(sortOptions);
    const sortField = sortEntries.length > 0 ? sortEntries[0][0] : '';
    const sortDirection = sortEntries.length > 0 ? normalizeSortDirection(sortEntries[0][1]) : 'asc';

    let data: UserGroup[] = [];
    let total = 0;

    if (search.trim()) {
      const all = (await prisma.userGroup.findMany({ where, select: USER_GROUP_SELECT })) as UserGroup[];
      const filtered = this.filterBySearch(all, search);
      total = filtered.length;

      data = sortField && sortDirection
        ? this.sortInMemory(filtered, sortField, sortDirection)
        : filtered.sort((a, b) => normalizeText(a.description).localeCompare(normalizeText(b.description), 'pt-BR', { sensitivity: 'base' }));

      data = data.slice(skip, skip + take);
    } else {
      const orderBy = this.buildOrderBy(sortOptions);
      const [items, count] = await Promise.all([
        prisma.userGroup.findMany({ where, skip, take, orderBy, select: USER_GROUP_SELECT }),
        prisma.userGroup.count({ where }),
      ]);
      data = items as UserGroup[];
      total = count;
    }

    return {
      data,
      count: total,
      totalPages: total ? Math.ceil(total / take) : 0,
      currentPage: page,
    };
  }

  private filterBySearch(groups: UserGroup[], searchTerm: string): UserGroup[] {
    if (!searchTerm.trim()) return groups;
    const normalized = normalizeText(searchTerm);
    return groups.filter((g) => normalizeText(g.description).includes(normalized));
  }

  private sortInMemory(items: UserGroup[], field: string, direction: 'asc' | 'desc'): UserGroup[] {
    return [...items].sort((a, b) => {
      const rawA = (a as unknown as Record<string, unknown>)[field] ?? '';
      const rawB = (b as unknown as Record<string, unknown>)[field] ?? '';

      if (rawA instanceof Date || rawB instanceof Date) {
        const timeA = rawA instanceof Date ? rawA.getTime() : 0;
        const timeB = rawB instanceof Date ? rawB.getTime() : 0;
        return direction === 'asc' ? timeA - timeB : timeB - timeA;
      }

      const valueA = normalizeText(String(rawA));
      const valueB = normalizeText(String(rawB));
      return direction === 'asc'
        ? valueA.localeCompare(valueB, 'pt-BR', { sensitivity: 'base' })
        : valueB.localeCompare(valueA, 'pt-BR', { sensitivity: 'base' });
    });
  }

  private buildWhereClauseWithoutSearch(filters: Record<string, unknown>, includeInactive: boolean) {
    const where: Record<string, unknown> = {};
    if (!includeInactive) where.deleted_at = null;

    const conditions = this.buildFilterConditions(filters);
    if (Object.keys(conditions).length > 0) where.AND = [conditions];

    return where;
  }

  private buildFilterConditions(filters: Record<string, unknown>) {
    const conditions: Record<string, unknown> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      if (key === 'description') {
        conditions[key] = { contains: String(value), mode: 'insensitive' };
      } else if (key === 'created_at' || key === 'updated_at') {
        conditions[key] = this.buildDateCondition(value);
      }
    });

    return conditions;
  }

  private buildDateCondition(value: unknown) {
    if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
      const range = value as { from: string; to: string };
      const fromDate = new Date(range.from);
      const toDate = new Date(range.to);
      toDate.setHours(23, 59, 59, 999);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) return { gte: fromDate, lte: toDate };
    } else if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return { gte: start, lte: end };
      }
    }
    return {};
  }

  private buildOrderBy(sortOptions: Record<string, string>) {
    const orderBy: Record<string, unknown>[] = [];

    Object.entries(sortOptions).forEach(([key, value]) => {
      if (!value) return;
      const direction = normalizeSortDirection(value);
      const field = key.replace('sort_', '');

      if (['description', 'created_at', 'updated_at'].includes(field)) {
        orderBy.push({ [field]: direction });
      } else if (field === 'creator.name' || field === 'creator_name') {
        orderBy.push({ creator: { name: direction } });
      } else if (field === 'updater.name' || field === 'updater_name') {
        orderBy.push({ updater: { name: direction } });
      }
    });

    if (orderBy.length === 0) orderBy.push({ description: 'asc' });
    return orderBy;
  }

  async getFilters(filters: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = { deleted_at: null };

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '' && key === 'description') {
        where[key] = { contains: String(value), mode: 'insensitive' };
      }
    });

    const groups = await prisma.userGroup.findMany({
      where,
      select: { description: true },
      distinct: ['description'],
      orderBy: { description: 'asc' },
    });

    const dateRange = await prisma.userGroup.aggregate({
      where,
      _min: { created_at: true },
      _max: { created_at: true },
    });

    return {
      filters: [
        {
          field: 'description',
          type: 'string',
          label: 'Descrição',
          description: 'Descrição do grupo de usuário',
          values: groups.filter((g) => g.description).map((g) => g.description.trim()),
          searchable: true,
          autocomplete: true,
        },
        {
          field: 'created_at',
          type: 'date',
          label: 'Data de Cadastro',
          description: 'Data de cadastro no sistema',
          min: dateRange._min.created_at?.toISOString().split('T')[0],
          max: dateRange._max.created_at?.toISOString().split('T')[0],
          dateRange: true,
        },
      ],
      operators: {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
      },
      defaultSort: 'description:asc',
      searchFields: ['description'],
    };
  }

  async findById(id: string, opts?: { includeDeleted?: boolean }): Promise<UserGroup | null> {
    // findFirst (não findUnique) para que a extensão do Prisma injete
    // company_id e o grupo de outra empresa não seja acessível.
    return prisma.userGroup.findFirst({
      where: opts?.includeDeleted ? { id } : { id, deleted_at: null },
      select: USER_GROUP_SELECT,
    });
  }

  async descriptionExists(description: string): Promise<boolean> {
    const existing = await prisma.userGroup.findFirst({ where: { description, deleted_at: null } });
    return !!existing;
  }

  async descriptionExistsExcept(description: string, exceptId: string): Promise<boolean> {
    const existing = await prisma.userGroup.findFirst({ where: { description, deleted_at: null, NOT: { id: exceptId } } });
    return !!existing;
  }

  async create(data: CreateUserGroupData): Promise<UserGroup> {
    const company_id = companyId();
    return prisma.userGroup.create({
      data: {
        description: data.description,
        company_id,
        created_by: data.created_by,
        updated_by: data.created_by,
      },
      select: USER_GROUP_SELECT,
    });
  }

  async update(id: string, data: UpdateUserGroupData): Promise<UserGroup> {
    return prisma.userGroup.update({
      where: { id },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        updated_by: data.updated_by,
      },
      select: USER_GROUP_SELECT,
    });
  }

  async touch(id: string, updatedBy: string | null): Promise<void> {
    await prisma.userGroup.update({ where: { id }, data: { updated_by: updatedBy } });
  }

  async softDelete(id: string, deletedBy: string | null): Promise<UserGroup> {
    return prisma.userGroup.update({
      where: { id },
      data: { deleted_at: new Date(), updated_by: deletedBy },
      select: USER_GROUP_SELECT,
    });
  }

  async restore(id: string, restoredBy: string | null): Promise<UserGroup> {
    return prisma.userGroup.update({
      where: { id },
      data: { deleted_at: null, updated_by: restoredBy },
      select: USER_GROUP_SELECT,
    });
  }

  async clone(sourceId: string, data: CreateUserGroupData): Promise<CloneUserGroupResult> {
    const company_id = companyId();

    const sourcePermissions = await prisma.userGroupPermission.findMany({
      where: { user_group_id: sourceId },
      select: {
        resource: true,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
        can_export: true,
        can_custom_field: true,
      },
    });

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.userGroup.create({
        data: {
          description: data.description,
          company_id,
          created_by: data.created_by,
          updated_by: data.created_by,
        },
        select: USER_GROUP_SELECT,
      });

      if (sourcePermissions.length > 0) {
        await tx.userGroupPermission.createMany({
          data: sourcePermissions.map((p) => ({ ...p, company_id, user_group_id: created.id })),
        });
      }

      return created;
    });

    return { group, clonedPermissions: sourcePermissions.length };
  }
}

export const prismaUserGroupsRepository = new PrismaUserGroupsRepository();
