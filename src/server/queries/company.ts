import 'server-only';
import { companyUseCases } from '@/infra/factories/company-factory';
import { requireSession, assertSuperAdmin } from '@/infra/auth/session';
import { listCompaniesQuerySchema } from '@/shared/validators/company';
import type { CompanyBranding, CompanyListResult, CompanyWithBranding, PublicBranding } from '@/core/entities/company';

/**
 * Queries (leitura) do módulo Company — para uso em Server Components.
 * Substituem os endpoints GET de `/company/*` e `/companies/*`.
 *
 * Camada: server (apresentação SSR). Guardas de permissão embutidas, espelhando
 * os middlewares por-rota do backend.
 * Origem: api-nairim-v2/src/controllers/CompanyController.ts (GETs).
 */

/** Branding público por slug (sem autenticação). Origem: GET /company/branding?slug=. */
export function getPublicBrandingData(slug: string): Promise<PublicBranding> {
  return companyUseCases.getPublicBranding.execute(slug);
}

/** Branding da empresa autenticada. Origem: GET /company/branding/me. */
export async function getMyBrandingData(): Promise<CompanyBranding | null> {
  const session = await requireSession();
  return companyUseCases.getMyBranding.execute(session.company_id);
}

/** Disponibilidade de slug (super admin). Origem: GET /company/check-slug/:slug. */
export async function checkSlugAvailabilityData(slug: string): Promise<{ available: boolean }> {
  const session = await requireSession();
  assertSuperAdmin(session);
  return companyUseCases.checkSlug.execute(slug);
}

/** Lista de empresas (admin). Origem: GET /companies | GET /company/list. */
export async function listCompaniesData(params: Record<string, unknown>): Promise<CompanyListResult> {
  const session = await requireSession();
  assertSuperAdmin(session);
  const parsed = listCompaniesQuerySchema.parse(params);
  return companyUseCases.list.execute(parsed);
}

/** Empresa por ID (admin). Origem: GET /company/:id | GET /companies/:id. */
export async function getCompanyByIdData(id: string): Promise<CompanyWithBranding> {
  const session = await requireSession();
  assertSuperAdmin(session);
  return companyUseCases.getById.execute(id);
}

/**
 * Configuração de filtros do DataTable de empresas (estático).
 * Origem: getCompanyFilters.
 */
export async function getCompanyFiltersData(): Promise<Record<string, unknown>> {
  const session = await requireSession();
  assertSuperAdmin(session);
  return {
    filters: [
      { field: 'name', type: 'string', label: 'Nome', searchable: true },
      { field: 'slug', type: 'string', label: 'Slug', searchable: true },
      {
        field: 'is_active',
        type: 'select',
        label: 'Status',
        values: [
          { value: 'true', label: 'Ativo' },
          { value: 'false', label: 'Inativo' },
        ],
      },
    ],
    operators: { string: ['contains', 'equals'], select: ['equals'], boolean: ['equals'] },
    defaultSort: 'name:asc',
    searchFields: ['name', 'slug'],
  };
}
