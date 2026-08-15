import 'server-only';
import { financialCenterUseCases } from '@/infra/factories/financial-center-factory';
import { withTenant } from '@/infra/auth/session';
import { listFinancialCentersQuerySchema } from '@/shared/validators/financial-center';
import type { Center, PaginatedCenters } from '@/core/entities/financial-center';

/**
 * Queries (leitura) do módulo Centros de Custo — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: CenterController (GETs).
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

export async function listFinancialCentersData(raw: Record<string, unknown>): Promise<PaginatedCenters> {
  const { limit, page, search, includeInactive } = listFinancialCentersQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withTenant(() =>
    financialCenterUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }),
  );
}

export async function getCenterByIdData(id: string): Promise<Center> {
  return withTenant(() => financialCenterUseCases.getById.execute(id));
}

export async function getCenterFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  void raw;
  return withTenant(() => financialCenterUseCases.getFilters.execute());
}