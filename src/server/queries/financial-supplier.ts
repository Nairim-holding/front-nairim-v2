import 'server-only';
import { financialSupplierUseCases } from '@/infra/factories/financial-supplier-factory';
import { withTenant } from '@/infra/auth/session';
import { listFinancialSuppliersQuerySchema } from '@/shared/validators/financial-supplier';
import type { PaginatedSuppliers, Supplier } from '@/core/entities/financial-supplier';

/**
 * Queries (leitura) do módulo Fornecedores — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: SupplierController (GETs).
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

export async function listFinancialSuppliersData(raw: Record<string, unknown>): Promise<PaginatedSuppliers> {
  const { limit, page, search, includeInactive } = listFinancialSuppliersQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withTenant(() =>
    financialSupplierUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }),
  );
}

export async function getSupplierByIdData(id: string): Promise<Supplier> {
  return withTenant(() => financialSupplierUseCases.getById.execute(id));
}

export async function getSupplierFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  void raw;
  return withTenant(() => financialSupplierUseCases.getFilters.execute());
}