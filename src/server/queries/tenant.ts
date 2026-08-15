import 'server-only';
import { tenantUseCases } from '@/infra/factories/tenant-factory';
import { withTenant } from '@/infra/auth/session';
import { listTenantsQuerySchema } from '@/shared/validators/tenant';
import type { ContactSuggestion } from '@/core/entities/agency';
import type { PaginatedTenants, Tenant } from '@/core/entities/tenant';

/**
 * Queries (leitura) do módulo Tenants — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: TenantController.ts (GETs).
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

export async function listTenantsData(raw: Record<string, unknown>): Promise<PaginatedTenants> {
  const { limit, page, search, includeInactive } = listTenantsQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withTenant(() => tenantUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }));
}

export async function getTenantByIdData(id: string): Promise<Tenant> {
  return withTenant(() => tenantUseCases.getById.execute(id));
}

export async function getTenantFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { filters } = splitListParams(raw);
  return withTenant(() => tenantUseCases.getFilters.execute(filters));
}

export async function getTenantContactSuggestionsData(search: string): Promise<ContactSuggestion[]> {
  return withTenant(() => tenantUseCases.getContactSuggestions.execute(search));
}

/**
 * Próximo código interno sugerido (MAX numérico + 1, escopo da empresa).
 * Origem: GET /tenants/next-internal-code (TenantController.getNextInternalCode).
 */
export async function getNextTenantInternalCodeData(): Promise<string> {
  return withTenant(() => tenantUseCases.getNextInternalCode.execute());
}
