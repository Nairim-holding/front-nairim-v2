'use server';

import { userGroupUseCases } from '@/infra/factories/user-group-factory';
import { createUserGroupSchema, updateUserGroupSchema } from '@/shared/validators/user-group';
import { upsertPermissionsSchema, validatePermissionRows } from '@/shared/validators/user-group-permission';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withPermission } from '@/infra/auth/session';
import type { CloneUserGroupResult, PaginatedUserGroups, UserGroup } from '@/core/entities/user-group';
import type { PermissionRow, ResourceCatalogItem } from '@/core/entities/user-group-permission';
import {
  listUserGroupsData,
  getUserGroupByIdData,
  getUserGroupFiltersData,
  getResourceCatalogData,
  getGroupPermissionsData,
} from '@/server/queries/user-group';

/**
 * Server Actions do módulo Grupos de Usuário. Substituem os endpoints de
 * `/user-groups`. Guarda: `withPermission('user-groups', action)`.
 * Camada: server. Origem: UserGroupController.ts.
 */

export async function createUserGroupAction(input: Record<string, unknown>): Promise<ActionResult<UserGroup>> {
  return runAction(async () => {
    const data = createUserGroupSchema.parse(input);
    return withPermission('user-groups', 'create', (session) =>
      userGroupUseCases.create.execute({ description: data.description, created_by: session.id }),
    );
  });
}

export async function updateUserGroupAction(id: string, input: Record<string, unknown>): Promise<ActionResult<UserGroup>> {
  return runAction(async () => {
    const data = updateUserGroupSchema.parse(input);
    return withPermission('user-groups', 'edit', (session) =>
      userGroupUseCases.update.execute(id, { description: data.description, updated_by: session.id }),
    );
  });
}

export async function deleteUserGroupAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withPermission('user-groups', 'delete', (session) => userGroupUseCases.remove.execute(id, session.id));
    return null;
  });
}

export async function restoreUserGroupAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withPermission('user-groups', 'edit', (session) => userGroupUseCases.restore.execute(id, session.id));
    return null;
  });
}

/** Clonar exige permissão de CRIAÇÃO — o resultado é um grupo novo, não uma edição. */
export async function cloneUserGroupAction(sourceId: string, input: Record<string, unknown>): Promise<ActionResult<CloneUserGroupResult>> {
  return runAction(async () => {
    const data = createUserGroupSchema.parse(input);
    return withPermission('user-groups', 'create', (session) =>
      userGroupUseCases.clone.execute(sourceId, { description: data.description, created_by: session.id }),
    );
  });
}

export async function upsertUserGroupPermissionsAction(id: string, input: Record<string, unknown>): Promise<ActionResult<PermissionRow[]>> {
  return runAction(async () => {
    const { permissions } = upsertPermissionsSchema.parse(input);
    validatePermissionRows(permissions as PermissionRow[]);
    return withPermission('user-groups', 'edit', (session) =>
      userGroupUseCases.upsertPermissions.execute(id, permissions as PermissionRow[], session.id),
    );
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listUserGroupsAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedUserGroups>> {
  return runAction(() => listUserGroupsData(raw));
}

export async function getUserGroupByIdAction(id: string): Promise<ActionResult<UserGroup>> {
  return runAction(() => getUserGroupByIdData(id));
}

export async function getUserGroupFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getUserGroupFiltersData(raw));
}

export async function getResourceCatalogAction(): Promise<ActionResult<ResourceCatalogItem[]>> {
  return runAction(() => getResourceCatalogData());
}

export async function getGroupPermissionsAction(id: string): Promise<ActionResult<PermissionRow[]>> {
  return runAction(() => getGroupPermissionsData(id));
}
