/**
 * Entidades de domínio: Categoria financeira (Category).
 *
 * Fidelidade ao backend: `getCategories` roda `ensureTransferCategories`
 * antes de listar (garante as categorias internas de transferência — ver
 * core/use-cases/transfer). `is_system` bloqueia update/delete. A busca em
 * memória considera o nome, o tipo em pt (`receita`/`despesa`) e o status
 * (`ativo`/`inativo`).
 *
 * Camada: core.
 * Origem: model `Category` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/CategoryService.ts.
 */

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const DFC_GROUPS = ['TAXES', 'VARIABLE_EXPENSE', 'FIXED_EXPENSE', 'PAYROLL'] as const;
export type DfcGroup = (typeof DFC_GROUPS)[number];

/** Registro de categoria financeira (com subcategorias não-excluídas opcionais). */
export interface Category {
  id: string;
  company_id: string;
  name: string;
  type: TransactionType;
  is_active: boolean;
  is_system: boolean;
  dfc_group: DfcGroup | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  subcategories?: unknown[];
  [key: string]: unknown;
}

/** Dados de criação. */
export interface CreateCategoryData {
  name: string;
  type: TransactionType;
  is_active?: boolean;
  dfc_group?: DfcGroup | null;
}

/** Dados de atualização (dfc_group é enviado só quando !== undefined). */
export interface UpdateCategoryData {
  name?: string;
  type?: TransactionType;
  is_active?: boolean;
  dfc_group?: DfcGroup | null;
}

export interface ListCategoriesParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedCategories {
  data: Category[];
  count: number;
  totalPages: number;
  currentPage: number;
}