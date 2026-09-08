import 'server-only';
import { ownerUseCases } from '@/infra/factories/owner-factory';
import { withPermission } from '@/infra/auth/session';
import { listOwnersQuerySchema } from '@/shared/validators/owner';
import type { ContactSuggestion } from '@/core/entities/agency';
import type { Owner, PaginatedOwners } from '@/core/entities/owner';

/**
 * Queries (leitura) do módulo Owners — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: OwnerController.ts (GETs).
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

export async function listOwnersData(raw: Record<string, unknown>): Promise<PaginatedOwners> {
  const { limit, page, search, includeInactive } = listOwnersQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withPermission('owners', 'view', () => ownerUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }));
}

export async function getOwnerByIdData(id: string): Promise<Owner> {
  return withPermission('owners', 'view', () => ownerUseCases.getById.execute(id));
}

export async function getOwnerFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { filters } = splitListParams(raw);
  return withPermission('owners', 'view', () => ownerUseCases.getFilters.execute(filters));
}

export async function getOwnerContactSuggestionsData(search: string): Promise<ContactSuggestion[]> {
  return withPermission('owners', 'view', () => ownerUseCases.getContactSuggestions.execute(search));
}
