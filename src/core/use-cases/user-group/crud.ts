import type { UserGroupsRepository } from '@/core/repositories/user-groups-repository';
import type {
  CreateUserGroupData,
  GetUserGroupsParams,
  PaginatedUserGroups,
  UpdateUserGroupData,
  UserGroup,
} from '@/core/entities/user-group';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de CRUD de Grupo de Usuário.
 * Camada: core. Origem: api-nairim-v2/src/controllers/UserGroupController.ts.
 */

export class ListUserGroupsUseCase {
  constructor(private readonly repo: UserGroupsRepository) {}
  execute(params: GetUserGroupsParams): Promise<PaginatedUserGroups> {
    return this.repo.list(params);
  }
}

export class GetUserGroupFiltersUseCase {
  constructor(private readonly repo: UserGroupsRepository) {}
  execute(filters?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.repo.getFilters(filters);
  }
}

export class GetUserGroupByIdUseCase {
  constructor(private readonly repo: UserGroupsRepository) {}
  async execute(id: string): Promise<UserGroup> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const group = await this.repo.findById(id);
    if (!group) throw new NotFoundError('Grupo de usuário não encontrado');
    return group;
  }
}

export class CreateUserGroupUseCase {
  constructor(private readonly repo: UserGroupsRepository) {}
  async execute(data: CreateUserGroupData): Promise<UserGroup> {
    const description = data.description.trim();
    if (await this.repo.descriptionExists(description)) {
      throw new ConflictError('Este grupo de usuário já existe');
    }
    return this.repo.create({ ...data, description });
  }
}

export class UpdateUserGroupUseCase {
  constructor(private readonly repo: UserGroupsRepository) {}
  async execute(id: string, data: UpdateUserGroupData): Promise<UserGroup> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Grupo de usuário não encontrado');

    const description = data.description !== undefined ? data.description.trim() : undefined;
    if (description && description !== existing.description) {
      if (await this.repo.descriptionExistsExcept(description, id)) {
        throw new ConflictError('Este grupo de usuário já existe');
      }
    }

    return this.repo.update(id, { ...data, description });
  }
}

export class DeleteUserGroupUseCase {
  constructor(private readonly repo: UserGroupsRepository) {}
  async execute(id: string, deletedBy: string | null): Promise<UserGroup> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Grupo de usuário não encontrado ou já excluído');
    return this.repo.softDelete(id, deletedBy);
  }
}

export class RestoreUserGroupUseCase {
  constructor(private readonly repo: UserGroupsRepository) {}
  async execute(id: string, restoredBy: string | null): Promise<UserGroup> {
    const existing = await this.repo.findById(id, { includeDeleted: true });
    if (!existing) throw new NotFoundError('Grupo de usuário não encontrado');
    if (!existing.deleted_at) throw new ValidationError('O grupo de usuário não está excluído');
    return this.repo.restore(id, restoredBy);
  }
}
