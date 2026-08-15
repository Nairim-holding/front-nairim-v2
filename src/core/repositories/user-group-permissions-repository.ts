import type { PermissionRow, ResolvedPermissions, ResourceCatalogItem } from '@/core/entities/user-group-permission';

/**
 * Contrato de acesso à matriz de permissões (UserGroupPermission).
 * Implementação Prisma: infra/repositories/prisma-user-group-permissions-repository.ts.
 * Tenant-scoped: `UserGroupPermission`/`UserGroup` estão em TENANT_MODELS.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/UserGroupPermissionService.ts.
 */
export interface UserGroupPermissionsRepository {
  /** Catálogo estático de recursos (sem I/O — vem de `shared/utils/menu-resources`). */
  getResourceCatalog(): ResourceCatalogItem[];

  /** Uma linha por recurso do catálogo — recurso sem permissão salva vem todo `false`. */
  getPermissions(userGroupId: string): Promise<PermissionRow[]>;

  /**
   * Substitui a matriz inteira do grupo (delete + createMany transacional).
   * Lança NotFoundError se o grupo não existir/pertencer à empresa.
   * Invalida o cache de `resolveForUser` ao final.
   */
  upsertPermissions(userGroupId: string, rows: PermissionRow[]): Promise<PermissionRow[]>;

  /**
   * Permissões efetivas do usuário, com cache em memória (TTL 60s).
   * `null` = sem grupo (ou grupo excluído) → sem restrição.
   */
  resolveForUser(userId: string): Promise<ResolvedPermissions | null>;

  /** Flush total do cache (chamado ao salvar diretivas de qualquer grupo). */
  invalidateCache(): void;
}
