import type {
  CreateSubcategoryData,
  ListSubcategoriesParams,
  PaginatedSubcategories,
  Subcategory,
  UpdateSubcategoryData,
} from '@/core/entities/subcategory';

/**
 * Contrato de acesso a dados de Subcategoria Financeira.
 * Implementação Prisma: infra/repositories/prisma-subcategories-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.subcategory.*` em api-nairim-v2/src/services/SubcategoryService.ts.
 */
export interface SubcategoriesRepository {
  list(params: ListSubcategoriesParams): Promise<PaginatedSubcategories>;
  getFilters(): Promise<Record<string, unknown>>;
  /** Subcategoria por ID (não excluída), incluindo a categoria pai. */
  findById(id: string): Promise<Subcategory | null>;
  create(data: CreateSubcategoryData): Promise<Subcategory>;
  update(id: string, data: UpdateSubcategoryData): Promise<Subcategory>;
  /**
   * Soft-delete. Lança conflito (409) se existirem transações não-excluídas
   * vinculadas (mensagem exata preservada do backend).
   */
  softDelete(id: string): Promise<Subcategory>;
  /** Estado de exclusão (para restore validar). */
  findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<Subcategory>;
  /** find-or-create insensível a maiúsculas por nome + categoria pai. */
  quickCreate(data: { name: string; category_id: string }): Promise<Subcategory>;
  /** Checa se a categoria pai existe (não excluída). */
  categoryExists(categoryId: string): Promise<boolean>;
}