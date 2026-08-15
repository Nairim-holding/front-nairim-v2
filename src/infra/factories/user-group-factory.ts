import { prismaUserGroupsRepository } from '@/infra/repositories/prisma-user-groups-repository';
import { prismaUserGroupPermissionsRepository } from '@/infra/repositories/prisma-user-group-permissions-repository';
import {
  ListUserGroupsUseCase, GetUserGroupFiltersUseCase, GetUserGroupByIdUseCase,
  CreateUserGroupUseCase, UpdateUserGroupUseCase, DeleteUserGroupUseCase, RestoreUserGroupUseCase,
} from '@/core/use-cases/user-group/crud';
import { CloneUserGroupUseCase } from '@/core/use-cases/user-group/clone';
import {
  GetResourceCatalogUseCase, GetGroupPermissionsUseCase, UpsertGroupPermissionsUseCase,
} from '@/core/use-cases/user-group/permissions';

/**
 * Composition root do módulo Grupos de Usuário.
 * Reaproveita `prismaUserGroupPermissionsRepository` (Módulo 13/Lote A) para
 * as diretivas — sem recriar essa camada.
 *
 * Camada: infra.
 */
export const userGroupUseCases = {
  list: new ListUserGroupsUseCase(prismaUserGroupsRepository),
  getFilters: new GetUserGroupFiltersUseCase(prismaUserGroupsRepository),
  getById: new GetUserGroupByIdUseCase(prismaUserGroupsRepository),
  create: new CreateUserGroupUseCase(prismaUserGroupsRepository),
  update: new UpdateUserGroupUseCase(prismaUserGroupsRepository),
  remove: new DeleteUserGroupUseCase(prismaUserGroupsRepository),
  restore: new RestoreUserGroupUseCase(prismaUserGroupsRepository),
  clone: new CloneUserGroupUseCase(prismaUserGroupsRepository),
  getResourceCatalog: new GetResourceCatalogUseCase(prismaUserGroupPermissionsRepository),
  getPermissions: new GetGroupPermissionsUseCase(prismaUserGroupsRepository, prismaUserGroupPermissionsRepository),
  upsertPermissions: new UpsertGroupPermissionsUseCase(prismaUserGroupsRepository, prismaUserGroupPermissionsRepository),
};
