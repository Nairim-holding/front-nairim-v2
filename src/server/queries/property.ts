import 'server-only';
import { propertyUseCases } from '@/infra/factories/property-factory';
import { withPermission } from '@/infra/auth/session';
import { listPropertiesQuerySchema } from '@/shared/validators/property';
import type { PaginatedProperties, Property } from '@/core/entities/property';

/**
 * Queries (leitura) do módulo Properties — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: PropertyController.ts (GETs).
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
    if (key.startsWith('sort_')) {
      const dir = value.toLowerCase();
      if (dir === 'asc' || dir === 'desc') sortOptions[key.replace('sort_', '')] = dir;
      return;
    }
    if (['limit', 'page', 'search', 'includeInactive'].includes(key) || key.startsWith('sort')) return;

    const filterMatch = key.match(/^filter\[(.+)\]$/);
    const filterKey = filterMatch ? filterMatch[1] : key;
    if (value.trim() === '') return;
    try {
      filters[filterKey] = JSON.parse(value);
    } catch {
      filters[filterKey] = value;
    }
  });

  return { sortOptions, filters };
}

export async function listPropertiesData(raw: Record<string, unknown>): Promise<PaginatedProperties> {
  const { limit, page, search, includeInactive } = listPropertiesQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withPermission('properties', 'view', () => propertyUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }));
}

export async function getPropertyByIdData(id: string): Promise<Property> {
  return withPermission('properties', 'view', () => propertyUseCases.getById.execute(id));
}

export async function getPropertyFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { filters } = splitListParams(raw);
  return withPermission('properties', 'view', () => propertyUseCases.getFilters.execute(filters));
}
