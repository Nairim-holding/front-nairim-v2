import 'server-only';
import { userGroupUseCases } from '@/infra/factories/user-group-factory';
import { withPermission } from '@/infra/auth/session';
import { listUserGroupsQuerySchema } from '@/shared/validators/user-group';
import type { PaginatedUserGroups, UserGroup } from '@/core/entities/user-group';
import type { PermissionRow, ResourceCatalogItem } from '@/core/entities/user-group-permission';

/**
 * Queries (leitura) do módulo Grupos de Usuário — para Server Components.
 * Guarda: `withPermission('user-groups', 'view')`.
 * Camada: server. Origem: UserGroupController.ts (GETs).
 */

/**
 * Extrai `sort`/`filters` do `raw`. Aceita os dois formatos de ordenação que
 * o controller original aceitava: `sort[campo]=dir` (preferencial) e o legado
 * `sort_campo=dir` — ambos viram `sortOptions['sort_campo']`, formato que
 * `PrismaUserGroupsRepository.buildOrderBy` já espera (remove o prefixo).
 */
function splitListParams(raw: Record<string, unknown>) {
  const sortOptions: Record<string, string> = {};
  const filters: Record<string, unknown> = {};

  Object.entries(raw ?? {}).forEach(([key, value]) => {
    if (typeof value !== 'string') return;

    const bracketMatch = key.match(/^sort\[(.+)\]$/);
    if (bracketMatch) {
      const dir = value.toLowerCase();
      if (dir === 'asc' || dir === 'desc') sortOptions[`sort_${bracketMatch[1]}`] = dir;
      return;
    }
    if (key.startsWith('sort_')) {
      const dir = value.toLowerCase();
      if (dir === 'asc' || dir === 'desc') sortOptions[key] = dir;
      return;
    }
    if (['limit', 'page', 'search', 'includeInactive'].includes(key) || value.trim() === '') return;

    const filterMatch = key.match(/^filter\[(.+)\]$/);
    const filterKey = filterMatch ? filterMatch[1] : key;
    try {
      filters[filterKey] = JSON.parse(value);
    } catch {
      filters[filterKey] = value;
    }
  });

  return { sortOptions, filters };
}

export async function listUserGroupsData(raw: Record<string, unknown>): Promise<PaginatedUserGroups> {
  const { limit, page, search, includeInactive } = listUserGroupsQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withPermission('user-groups', 'view', () =>
    userGroupUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }),
  );
}

export async function getUserGroupByIdData(id: string): Promise<UserGroup> {
  return withPermission('user-groups', 'view', () => userGroupUseCases.getById.execute(id));
}

export async function getUserGroupFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { filters } = splitListParams(raw);
  return withPermission('user-groups', 'view', () => userGroupUseCases.getFilters.execute(filters));
}

export async function getResourceCatalogData(): Promise<ResourceCatalogItem[]> {
  return withPermission('user-groups', 'view', () => Promise.resolve(userGroupUseCases.getResourceCatalog.execute()));
}

export async function getGroupPermissionsData(id: string): Promise<PermissionRow[]> {
  return withPermission('user-groups', 'view', () => userGroupUseCases.getPermissions.execute(id));
}
