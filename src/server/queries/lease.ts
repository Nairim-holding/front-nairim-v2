import 'server-only';
import { leaseUseCases } from '@/infra/factories/lease-factory';
import { withTenant } from '@/infra/auth/session';
import { listLeasesQuerySchema } from '@/shared/validators/lease';
import type { CancellationPreview, Lease, PaginatedLeases } from '@/core/entities/lease';

/**
 * Queries (leitura) do módulo Leases — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: LeaseController.ts (GETs).
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
    if (['limit', 'page', 'search'].includes(key) || value.trim() === '') return;

    const filterMatch = key.match(/^filter\[(.+)\]$/);
    const filterKey = filterMatch ? filterMatch[1] : key;
    if (key !== 'sort' && !key.startsWith('sort[')) {
      try {
        filters[filterKey] = JSON.parse(value);
      } catch {
        filters[filterKey] = value;
      }
    }
  });

  // Normaliza aliases de ordenação (property_title → property.title etc), como
  // o LeaseController fazia antes de repassar ao service.
  const fieldMap: Record<string, string> = {
    property_title: 'property.title',
    type_description: 'property.type.description',
    owner_name: 'owner.name',
    tenant_name: 'tenant.name',
  };
  const normalizedSort: Record<string, string> = {};
  Object.entries(sortOptions).forEach(([field, dir]) => {
    normalizedSort[fieldMap[field] || field] = dir;
  });

  return { sortOptions: normalizedSort, filters };
}

export async function listLeasesData(raw: Record<string, unknown>): Promise<PaginatedLeases> {
  const { limit, page, search } = listLeasesQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withTenant(() => leaseUseCases.list.execute({ limit, page, search, sortOptions, filters }));
}

export async function getLeaseByIdData(id: string): Promise<Lease> {
  return withTenant(() => leaseUseCases.getById.execute(id));
}

export async function getLeaseFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { filters } = splitListParams(raw);
  return withTenant(() => leaseUseCases.getFilters.execute(filters));
}

export async function getCancellationPreviewData(id: string, date: string): Promise<CancellationPreview> {
  return withTenant(() => leaseUseCases.getCancellationPreview.execute(id, date));
}
