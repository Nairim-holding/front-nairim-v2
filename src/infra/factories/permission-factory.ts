import { prismaUserGroupPermissionsRepository } from '@/infra/repositories/prisma-user-group-permissions-repository';
import { GetMyPermissionsUseCase } from '@/core/use-cases/permission/get-my-permissions';

/** Composition root do módulo Permissions. Camada: infra. */
export const permissionUseCases = {
  getMy: new GetMyPermissionsUseCase(prismaUserGroupPermissionsRepository),
};
