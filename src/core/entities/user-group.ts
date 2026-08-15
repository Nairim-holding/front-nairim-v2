/**
 * Entidades de Grupo de Usuário (UserGroup) — CRUD + clone.
 * A matriz de permissões (UserGroupPermission) tem entidade própria em
 * `core/entities/user-group-permission.ts`, já portada no Módulo 13/Lote A.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/types/user-group.ts + UserGroupService.ts.
 */

export interface UserGroup {
  id: string;
  description: string;
  created_by: string | null;
  created_at: Date;
  updated_by: string | null;
  updated_at: Date;
  deleted_at: Date | null;
  creator: { id: string; name: string } | null;
  updater: { id: string; name: string } | null;
}

export interface CreateUserGroupData {
  description: string;
  created_by: string | null;
}

export interface UpdateUserGroupData {
  description?: string;
  updated_by: string | null;
}

export interface GetUserGroupsParams {
  limit?: number;
  page?: number;
  search?: string;
  filters?: Record<string, unknown>;
  sortOptions?: Record<string, string>;
  includeInactive?: boolean;
}

export interface PaginatedUserGroups {
  data: UserGroup[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface CloneUserGroupResult {
  group: UserGroup;
  clonedPermissions: number;
}
