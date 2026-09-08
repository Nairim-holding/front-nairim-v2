import 'server-only';
import { financialCategoryUseCases } from '@/infra/factories/financial-category-factory';
import { withPermission } from '@/infra/auth/session';
import { listFinancialCategoriesQuerySchema } from '@/shared/validators/financial-category';
import type { Category, PaginatedCategories } from '@/core/entities/category';

/**
 * Queries (leitura) do módulo Categorias Financeiras — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: CategoryController (GETs).
 */
function splitListParams(raw: Record<string, unknown>) {
  const sortOptions: Record<string, string> = {};
  const filters: Record<string, unknown> = {};

  Object.entries(raw ?? {}).forEach(([key, value]) => {
    if (typeof value !== 'string') return;
    const sortMatch = key.match(/^sort\[(.+)\]$/);
    if (sortMatch) {
      const dir = value.toLowerCase();
      if (dir === 'asc' || dir === 'desc') sortOptions[sortMatch[1]] = dir;
      return;
    }
    if (['limit', 'page', 'search', 'includeInactive'].includes(key) || value.trim() === '') return;

    const filterMatch = key.match(/^filter\[(.+)\]$/);
    if (filterMatch) {
      filters[filterMatch[1]] = value;
    } else if (key !== 'sort' && !key.startsWith('sort[')) {
      try {
        filters[key] = JSON.parse(value);
      } catch {
        filters[key] = value;
      }
    }
  });

  return { sortOptions, filters };
}

export async function listFinancialCategoriesData(raw: Record<string, unknown>): Promise<PaginatedCategories> {
  const { limit, page, search, includeInactive } = listFinancialCategoriesQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withPermission('financial-categories', 'view', () =>
    financialCategoryUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }),
  );
}

export async function getCategoryByIdData(id: string): Promise<Category> {
  return withPermission('financial-categories', 'view', () => financialCategoryUseCases.getById.execute(id));
}

export async function getCategoryFiltersData(): Promise<Record<string, unknown>> {
  return withPermission('financial-categories', 'view', () => financialCategoryUseCases.getFilters.execute());
}
