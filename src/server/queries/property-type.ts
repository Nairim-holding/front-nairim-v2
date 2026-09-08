import 'server-only';
import { propertyTypeUseCases } from '@/infra/factories/property-type-factory';
import { withPermission } from '@/infra/auth/session';
import { listPropertyTypesQuerySchema } from '@/shared/validators/property-type';
import type { PaginatedPropertyTypes, PropertyType } from '@/core/entities/property-type';

/**
 * Queries (leitura) do módulo Property-types — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: PropertyTypeController.ts (GETs).
 */
function splitListParams(raw: Record<string, unknown>) {
  const sortOptions: Record<string, string> = {};
  const filters: Record<string, unknown> = {};

  Object.entries(raw ?? {}).forEach(([key, value]) => {
    if (typeof value !== 'string') return;
    if (key.startsWith('sort[') && key.endsWith(']')) {
      const field = key.substring(5, key.length - 1);
      const dir = value.toLowerCase();
      if (dir === 'asc' || dir === 'desc') sortOptions[`sort_${field}`] = dir;
      return;
    }
    if (key.startsWith('sort_')) {
      const dir = value.toLowerCase();
      if (dir === 'asc' || dir === 'desc') sortOptions[key] = dir;
      return;
    }
    if (['limit', 'page', 'search', 'includeInactive'].includes(key) || key.startsWith('sort')) return;

    if (value !== '' && value !== 'undefined' && value !== 'null') {
      const filterMatch = key.match(/^filter\[(.+)\]$/);
      const filterKey = filterMatch ? filterMatch[1] : key;
      try {
        filters[filterKey] = value.startsWith('{') || value.startsWith('[') ? JSON.parse(value) : value;
      } catch {
        filters[filterKey] = value;
      }
    }
  });

  return { sortOptions, filters };
}

export async function listPropertyTypesData(raw: Record<string, unknown>): Promise<PaginatedPropertyTypes> {
  const { limit, page, search, includeInactive } = listPropertyTypesQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withPermission('property-types', 'view', () => propertyTypeUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }));
}

export async function getPropertyTypeByIdData(id: string): Promise<PropertyType> {
  return withPermission('property-types', 'view', () => propertyTypeUseCases.getById.execute(id));
}

export async function getPropertyTypeFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { filters } = splitListParams(raw);
  return withPermission('property-types', 'view', () => propertyTypeUseCases.getFilters.execute(filters));
}
