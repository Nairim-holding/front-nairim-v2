import 'server-only';
import { agencyUseCases } from '@/infra/factories/agency-factory';
import { withTenant } from '@/infra/auth/session';
import { listAgenciesQuerySchema } from '@/shared/validators/agency';
import type { Agency, ContactSuggestion, PaginatedAgencies } from '@/core/entities/agency';

/**
 * Queries (leitura) do módulo Agencies — para Server Components.
 * Guarda: `withTenant` (autenticado + empresa), igual ao backend.
 *
 * Camada: server (apresentação SSR).
 * Origem: api-nairim-v2/src/controllers/AgencyController.ts (GETs).
 */

/**
 * Separa os parâmetros crus em ordenação (`sort[campo]=dir`) e filtros
 * (`filter[campo]` ou chave direta com valor JSON) — porte do AgencyController.
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

/** Lista imobiliárias. Origem: GET /agencies. */
export async function listAgenciesData(raw: Record<string, unknown>): Promise<PaginatedAgencies> {
  const { limit, page, search, includeInactive } = listAgenciesQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withTenant(() => agencyUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }));
}

/** Imobiliária por ID. Origem: GET /agencies/:id. */
export async function getAgencyByIdData(id: string): Promise<Agency> {
  return withTenant(() => agencyUseCases.getById.execute(id));
}

/** Filtros contextuais. Origem: GET /agencies/filters. */
export async function getAgencyFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { filters } = splitListParams(raw);
  return withTenant(() => agencyUseCases.getFilters.execute(filters));
}

/** Sugestões de contato. Origem: GET /agencies/suggestions/contacts. */
export async function getContactSuggestionsData(search: string): Promise<ContactSuggestion[]> {
  return withTenant(() => agencyUseCases.getContactSuggestions.execute(search));
}
