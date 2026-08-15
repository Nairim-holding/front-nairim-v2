import type { UserGroupsRepository } from '@/core/repositories/user-groups-repository';
import type { CloneUserGroupResult, CreateUserGroupData } from '@/core/entities/user-group';
import { ConflictError, NotFoundError } from '@/core/errors/domain-errors';

/**
 * Clona um grupo, copiando todas as diretivas para um grupo novo. Exige
 * permissão de CRIAÇÃO no guard (`withPermission('user-groups', 'create')`)
 * — o resultado é um grupo novo, não uma edição.
 *
 * Camada: core. Origem: api-nairim-v2/src/controllers/UserGroupController.ts
 * (cloneUserGroup) + UserGroupService.cloneUserGroup.
 */
export class CloneUserGroupUseCase {
  constructor(private readonly repo: UserGroupsRepository) {}

  async execute(sourceId: string, data: CreateUserGroupData): Promise<CloneUserGroupResult> {
    const source = await this.repo.findById(sourceId);
    if (!source) throw new NotFoundError('Grupo de usuário de origem não encontrado');

    const description = data.description.trim();
    if (await this.repo.descriptionExists(description)) {
      throw new ConflictError('Já existe um grupo de usuário com essa descrição');
    }

    return this.repo.clone(sourceId, { ...data, description });
  }
}
