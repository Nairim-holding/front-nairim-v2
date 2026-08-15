import type {
  CloneUserGroupResult,
  CreateUserGroupData,
  GetUserGroupsParams,
  PaginatedUserGroups,
  UpdateUserGroupData,
  UserGroup,
} from '@/core/entities/user-group';

/**
 * Contrato de acesso a dados de Grupo de Usuário.
 * Implementação Prisma: infra/repositories/prisma-user-groups-repository.ts.
 * Tenant-scoped: `UserGroup` está em TENANT_MODELS.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/UserGroupService.ts.
 */
export interface UserGroupsRepository {
  list(params: GetUserGroupsParams): Promise<PaginatedUserGroups>;
  getFilters(filters?: Record<string, unknown>): Promise<Record<string, unknown>>;
  findById(id: string, opts?: { includeDeleted?: boolean }): Promise<UserGroup | null>;
  descriptionExists(description: string): Promise<boolean>;
  descriptionExistsExcept(description: string, exceptId: string): Promise<boolean>;

  create(data: CreateUserGroupData): Promise<UserGroup>;
  update(id: string, data: UpdateUserGroupData): Promise<UserGroup>;

  /** Marca o grupo como alterado (updated_by/updated_at) sem mudar os dados — salvar diretivas conta como editar o grupo. */
  touch(id: string, updatedBy: string | null): Promise<void>;

  softDelete(id: string, deletedBy: string | null): Promise<UserGroup>;
  restore(id: string, restoredBy: string | null): Promise<UserGroup>;

  /**
   * Cria um grupo novo e copia as diretivas de `sourceId` — transacional,
   * não-destrutivo (nenhum grupo existente é alterado).
   */
  clone(sourceId: string, data: CreateUserGroupData): Promise<CloneUserGroupResult>;
}
