import type { PermissionAction } from '@/shared/utils/menu-resources';

/**
 * Entidades da matriz de permissões (UserGroupPermission).
 * Porte de api-nairim-v2/src/types/user-group-permission.ts.
 *
 * Camada: core.
 */

/** Uma linha da matriz, como trafega na API. */
export interface PermissionRow {
  resource: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_custom_field: boolean;
}

/** Catálogo enviado ao front para montar as linhas. */
export interface ResourceCatalogItem {
  key: string;
  label: string;
  group: string;
  actions: PermissionAction[];
}

/** Permissões resolvidas de um usuário, em memória (cache do guard). */
export type ResolvedPermissions = Map<string, Set<PermissionAction>>;

export interface UpsertPermissionsInput {
  permissions: PermissionRow[];
}

/** Resposta de `GET /permissions/me` — usada por `PermissionsContext`. */
export interface ResolvedPermissionsResponse {
  unrestricted: boolean;
  resources: Record<string, Record<string, boolean>>;
}
