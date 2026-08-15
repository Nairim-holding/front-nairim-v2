import type { UserGroupsRepository } from '@/core/repositories/user-groups-repository';
import type { UserGroupPermissionsRepository } from '@/core/repositories/user-group-permissions-repository';
import type { PermissionRow, ResourceCatalogItem } from '@/core/entities/user-group-permission';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de diretivas de acesso de um grupo específico — combinam
 * `UserGroupsRepository` (checagem de existência/tenant do grupo) com
 * `UserGroupPermissionsRepository` (leitura/escrita da matriz, já portado no
 * Módulo 13/Lote A, reaproveitado aqui sem duplicar).
 *
 * Camada: core. Origem: api-nairim-v2/src/controllers/UserGroupController.ts
 * (getResourceCatalog/getPermissions/updatePermissions).
 */

export class GetResourceCatalogUseCase {
  constructor(private readonly permissionsRepo: UserGroupPermissionsRepository) {}
  execute(): ResourceCatalogItem[] {
    return this.permissionsRepo.getResourceCatalog();
  }
}

export class GetGroupPermissionsUseCase {
  constructor(
    private readonly groupsRepo: UserGroupsRepository,
    private readonly permissionsRepo: UserGroupPermissionsRepository,
  ) {}

  async execute(userGroupId: string): Promise<PermissionRow[]> {
    if (!userGroupId) throw new ValidationError('O ID é obrigatório');
    // Garante que o grupo existe e é da empresa do usuário antes de expor diretivas.
    const group = await this.groupsRepo.findById(userGroupId);
    if (!group) throw new NotFoundError('Grupo de usuário não encontrado');
    return this.permissionsRepo.getPermissions(userGroupId);
  }
}

export class UpsertGroupPermissionsUseCase {
  constructor(
    private readonly groupsRepo: UserGroupsRepository,
    private readonly permissionsRepo: UserGroupPermissionsRepository,
  ) {}

  async execute(userGroupId: string, rows: PermissionRow[], updatedBy: string | null): Promise<PermissionRow[]> {
    const saved = await this.permissionsRepo.upsertPermissions(userGroupId, rows);
    // Registra quem alterou o grupo, já que mexer nas diretivas é alterá-lo.
    await this.groupsRepo.touch(userGroupId, updatedBy);
    return saved;
  }
}
