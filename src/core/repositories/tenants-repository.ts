import type { ContactSuggestion } from '@/core/entities/agency';
import type {
  CreateTenantData,
  ListTenantsParams,
  PaginatedTenants,
  Tenant,
  UpdateTenantData,
} from '@/core/entities/tenant';

/**
 * Contrato de acesso a dados de Inquilino (Tenant).
 * Implementação Prisma: infra/repositories/prisma-tenants-repository.ts.
 * Tenant-scoped (empresa): todos os métodos rodam dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.tenant.*` em api-nairim-v2/src/services/TenantService.ts.
 */
export interface TenantsRepository {
  list(params: ListTenantsParams): Promise<PaginatedTenants>;
  getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** Tenant por ID com endereços/contatos/leases (raso), ou `null`. */
  findById(id: string): Promise<Tenant | null>;
  internalCodeExists(code: string): Promise<boolean>;
  internalCodeExistsExcept(code: string, exceptId: string): Promise<boolean>;
  cpfExists(cpf: string): Promise<boolean>;
  cpfExistsExcept(cpf: string, exceptId: string): Promise<boolean>;
  cnpjExists(cnpj: string): Promise<boolean>;
  cnpjExistsExcept(cnpj: string, exceptId: string): Promise<boolean>;
  /**
   * Próximo código interno disponível: MAX numérico dos internal_code da
   * empresa + 1 (códigos não numéricos são ignorados). Retorna string.
   */
  getNextInternalCode(): Promise<string>;
  create(data: CreateTenantData): Promise<Tenant>;
  update(id: string, data: UpdateTenantData): Promise<Tenant>;
  /**
   * Soft-delete (+ contatos + endereços). Fiel ao backend: NÃO verifica
   * existência antes — se o id não existir, a atualização do Prisma lança
   * (P2025), que o error-handler traduz para 404.
   */
  softDelete(id: string): Promise<{ name: string }>;
  findDeletionState(id: string): Promise<{ name: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<Tenant>;
  getAvailableContacts(search: string): Promise<ContactSuggestion[]>;
}
