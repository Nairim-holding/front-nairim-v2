import type {
  Category,
  CreateCategoryData,
  ListCategoriesParams,
  PaginatedCategories,
  UpdateCategoryData,
} from '@/core/entities/category';
import type { EnsureTransferCategoriesResult } from '@/core/entities/transfer';

/**
 * Contrato de acesso a dados de Categoria Financeira.
 * Implementação Prisma: infra/repositories/prisma-financial-categories-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.category.*` em api-nairim-v2/src/services/CategoryService.ts.
 */
export interface CategoriesRepository {
  list(params: ListCategoriesParams): Promise<PaginatedCategories>;
  getFilters(): Promise<Record<string, unknown>>;
  /** Categoria por ID (não excluída), incluindo subcategorias ativas. */
  findById(id: string): Promise<Category | null>;
  create(data: CreateCategoryData): Promise<Category>;
  update(id: string, data: UpdateCategoryData): Promise<Category>;
  /**
   * Soft-delete. Lança erro de domínio conforme regras do backend:
   * sistema (403), lançamentos relacionados (409) ou subcategorias vinculadas (409).
   */
  softDelete(id: string): Promise<Category>;
  /** Estado de exclusão (para restore validar). */
  findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<Category>;
  /** find-or-create insensível a maiúsculas pelo nome + tipo. */
  quickCreate(data: { name: string; type: 'INCOME' | 'EXPENSE' }): Promise<Category>;
  /** Garante as duas categorias internas de transferência (idempotente). */
  ensureTransferCategories(): Promise<EnsureTransferCategoriesResult>;
}