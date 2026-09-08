import 'server-only';
import { financialSubcategoryUseCases } from '@/infra/factories/financial-subcategory-factory';
import { withPermission } from '@/infra/auth/session';
import { listFinancialSubcategoriesQuerySchema } from '@/shared/validators/financial-subcategory';
import type { PaginatedSubcategories, Subcategory } from '@/core/entities/subcategory';

/**
 * Queries (leitura) do módulo Subcategorias Financeiras — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: SubcategoryController (GETs).
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

export async function listFinancialSubcategoriesData(raw: Record<string, unknown>): Promise<PaginatedSubcategories> {
  const { limit, page, search, includeInactive } = listFinancialSubcategoriesQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withPermission('financial-categories', 'view', () =>
    financialSubcategoryUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }),
  );
}

export async function getSubcategoryByIdData(id: string): Promise<Subcategory> {
  return withPermission('financial-categories', 'view', () => financialSubcategoryUseCases.getById.execute(id));
}

export async function getSubcategoryFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  void raw;
  return withPermission('financial-categories', 'view', () => financialSubcategoryUseCases.getFilters.execute());
}
