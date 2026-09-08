import prisma from '@/infra/database/prisma';
import type { UserGroupPermissionsRepository } from '@/core/repositories/user-group-permissions-repository';
import type { PermissionRow, ResolvedPermissions, ResourceCatalogItem } from '@/core/entities/user-group-permission';
import { MENU_RESOURCES, ACTION_COLUMN, PERMISSION_ACTIONS, type PermissionAction } from '@/shared/utils/menu-resources';
import { NotFoundError } from '@/core/errors/domain-errors';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';

/**
 * Implementação Prisma de {@link UserGroupPermissionsRepository}.
 * Porte de api-nairim-v2/src/services/UserGroupPermissionService.ts.
 * Tenant-scoped: `UserGroup`/`UserGroupPermission` estão em TENANT_MODELS.
 *
 * Camada: infra.
 */

function companyId(): string {
  const id = getCurrentCompanyId();
  if (!id) throw new Error('Company context not found');
  return id;
}

export class PrismaUserGroupPermissionsRepository implements UserGroupPermissionsRepository {
  invalidateCache(): void {
    // Permissions are read fresh so group changes take effect on every instance.
  }

  getResourceCatalog(): ResourceCatalogItem[] {
    return MENU_RESOURCES.map(({ key, label, group, actions }) => ({ key, label, group, actions }));
  }

  async getPermissions(userGroupId: string): Promise<PermissionRow[]> {
    const saved = await prisma.userGroupPermission.findMany({
      where: { user_group_id: userGroupId },
    });

    const byResource = new Map(saved.map((p) => [p.resource, p]));

    return MENU_RESOURCES.map((resource) => {
      const row = byResource.get(resource.key);
      return {
        resource: resource.key,
        can_view: row?.can_view ?? false,
        can_create: row?.can_create ?? false,
        can_edit: row?.can_edit ?? false,
        can_delete: row?.can_delete ?? false,
        can_export: row?.can_export ?? false,
        can_custom_field: row?.can_custom_field ?? false,
      };
    });
  }

  async upsertPermissions(userGroupId: string, rows: PermissionRow[]): Promise<PermissionRow[]> {
    const company_id = companyId();

    // findFirst é escopado por empresa: garante que o grupo é da empresa do usuário.
    const group = await prisma.userGroup.findFirst({
      where: { id: userGroupId, deleted_at: null },
      select: { id: true },
    });
    if (!group) throw new NotFoundError('Grupo de usuário não encontrado');

    const toPersist = rows
      .filter((r) => PERMISSION_ACTIONS.some((a) => r[ACTION_COLUMN[a] as keyof PermissionRow] === true))
      .map((r) => ({
        company_id,
        user_group_id: userGroupId,
        resource: r.resource,
        can_view: r.can_view === true,
        can_create: r.can_create === true,
        can_edit: r.can_edit === true,
        can_delete: r.can_delete === true,
        can_export: r.can_export === true,
        can_custom_field: r.can_custom_field === true,
      }));

    // Troca atômica. deleteMany leva company_id explícito porque a extensão
    // do Prisma não intercepta deleteMany (só findMany/findFirst/count/
    // aggregate/groupBy/create/createMany — ver infra/database/prisma.ts).
    await prisma.$transaction(async (tx) => {
      await tx.userGroupPermission.deleteMany({ where: { user_group_id: userGroupId, company_id } });
      if (toPersist.length > 0) {
        await tx.userGroupPermission.createMany({ data: toPersist });
      }
    });

    this.invalidateCache();

    return this.getPermissions(userGroupId);
  }

  async resolveForUser(userId: string): Promise<ResolvedPermissions | null> {
    // Resolve against the current company on every call. No cross-request
    // cache: assigning/revoking a group must apply to the next request.

    // findFirst é escopado por empresa pela extensão do Prisma.
    const user = await prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
      select: {
        user_group_id: true,
        group: { select: { company_id: true, deleted_at: true, permissions: true } },
      },
    });

    let perms: ResolvedPermissions | null;

    if (!user || (user.user_group_id && (!user.group || user.group.deleted_at || user.group.company_id !== companyId()))) {
      // A missing user or invalid group must never grant unrestricted access.
      perms = new Map();
    } else if (!user.user_group_id) {
      // Preserve the explicit legacy policy for existing users without a group.
      perms = null;
    } else {
      perms = new Map<string, Set<PermissionAction>>();
      for (const row of user.group!.permissions) {
        if (row.company_id !== companyId()) continue;
        const granted = new Set<PermissionAction>();
        for (const action of PERMISSION_ACTIONS) {
          if (row[ACTION_COLUMN[action] as keyof typeof row] === true) granted.add(action);
        }
        perms.set(row.resource, granted);
      }
    }

    return perms;
  }
}

export const prismaUserGroupPermissionsRepository = new PrismaUserGroupPermissionsRepository();
