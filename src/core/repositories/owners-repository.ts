import type { ContactSuggestion } from '@/core/entities/agency';
import type {
  CreateOwnerData,
  ListOwnersParams,
  Owner,
  PaginatedOwners,
  UpdateOwnerData,
} from '@/core/entities/owner';

/**
 * Contrato de acesso a dados de Proprietário (Owner).
 * Implementação Prisma: infra/repositories/prisma-owners-repository.ts.
 * Tenant-scoped: todos os métodos rodam dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.owner.*` em api-nairim-v2/src/services/OwnerService.ts.
 */
export interface OwnersRepository {
  list(params: ListOwnersParams): Promise<PaginatedOwners>;
  getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** Owner por ID com endereços/contatos/properties/leases, ou `null`. */
  findById(id: string): Promise<Owner | null>;
  internalCodeExists(code: string): Promise<boolean>;
  internalCodeExistsExcept(code: string, exceptId: string): Promise<boolean>;
  cpfExists(cpf: string): Promise<boolean>;
  cpfExistsExcept(cpf: string, exceptId: string): Promise<boolean>;
  cnpjExists(cnpj: string): Promise<boolean>;
  cnpjExistsExcept(cnpj: string, exceptId: string): Promise<boolean>;
  create(data: CreateOwnerData): Promise<Owner>;
  update(id: string, data: UpdateOwnerData): Promise<Owner>;
  /** Soft-delete (+ contatos + endereços). @returns null se já não existir/excluído. */
  softDelete(id: string): Promise<{ name: string } | null>;
  findDeletionState(id: string): Promise<{ name: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<Owner>;
  getAvailableContacts(search: string): Promise<ContactSuggestion[]>;
}
