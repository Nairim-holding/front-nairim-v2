import type { Category } from '@/core/entities/category';

/**
 * Entidades de domínio: Subcategoria financeira (Subcategory).
 *
 * Fidelidade ao backend: a listagem do Express NÃO recebe `company_id` (as
 * subcategorias são retornadas sem escopo de empresa no `SubcategoryService`).
 * Na migração isso muda de comportamento: `Subcategory` está em TENANT_MODELS
 * e a extensão multi-tenant injeta `company_id` automaticamente, tornando a
 * leitura escopada à empresa (consistente com os demais endpoints do menu
 * financeiro). Divergência intencional, documentada.
 *
 * Camada: core.
 * Origem: model `Subcategory` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/SubcategoryService.ts.
 */

export interface Subcategory {
  id: string;
  company_id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  category?: Category | null;
}

export interface CreateSubcategoryData {
  name: string;
  category_id: string;
  is_active?: boolean;
}

export interface UpdateSubcategoryData {
  name?: string;
  category_id?: string;
  is_active?: boolean;
}

export interface ListSubcategoriesParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedSubcategories {
  data: Subcategory[];
  count: number;
  totalPages: number;
  currentPage: number;
}