import type {
  CreateSupplierData,
  ListSuppliersParams,
  PaginatedSuppliers,
  Supplier,
  UpdateSupplierData,
} from '@/core/entities/financial-supplier';

/**
 * Contrato de acesso a dados de Fornecedor.
 * Implementação Prisma: infra/repositories/prisma-financial-suppliers-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.supplier.*` em api-nairim-v2/src/services/SupplierService.ts.
 */
export interface SuppliersRepository {
  list(params: ListSuppliersParams): Promise<PaginatedSuppliers>;
  getFilters(): Promise<Record<string, unknown>>;
  /** Fornecedor por ID (não excluído), com contatos e endereços vinculados. */
  findById(id: string): Promise<Supplier | null>;
  create(data: CreateSupplierData): Promise<Supplier>;
  update(id: string, data: UpdateSupplierData): Promise<Supplier>;
  /**
   * Soft-delete do fornecedor + contatos e endereços vinculados.
   * Sem checagem de transações (fiel ao backend).
   */
  softDelete(id: string): Promise<Supplier>;
  /** Estado de exclusão (para restore validar). */
  findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<Supplier>;
  /**
   * find-or-create insensível a maiúsculas pelo `legal_name`, com geração de
   * `internal_code` sequencial numérico (com retry em corrida P2002).
   */
  quickCreate(data: { legal_name: string }): Promise<Supplier>;
}