import 'server-only';
import { publicUseCases } from '@/infra/factories/public-factory';
import { runWithTenant } from '@/infra/database/tenant-context';
import { parsePublicListParams } from '@/shared/validators/public';
import { NotFoundError } from '@/core/errors/domain-errors';
import type {
  PublicAgency,
  PublicOwner,
  PublicPaginated,
  PublicProperty,
  PublicPropertyType,
} from '@/core/entities/public-property';

/**
 * Queries (leitura) da vitrine PÚBLICA (`/public/:companySlug`).
 *
 * Diferente dos demais módulos (que usam `withTenant` com sessão JWT), aqui o
 * tenant vem do SLUG da URL: resolvemos a empresa ativa por slug (equivale ao
 * middleware `resolveCompanyBySlug` do backend) e abrimos o contexto com
 * `runWithTenant(company.id)`. Não há autenticação pública.
 *
 * Camada: server.
 * Origem: PublicController (rotas `/public/:companySlug/*`).
 */

/** Resolve a empresa pelo slug; 404 com a mesma mensagem do backend. */
async function withCompanySlug<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  const company = await publicUseCases.getCompanyBySlug.execute(slug);
  if (!company) throw new NotFoundError('Empresa não encontrada');
  return runWithTenant(company.id, fn);
}

export async function getPublicPropertiesData(
  slug: string,
  raw: Record<string, unknown>,
  opts?: { availableOnly?: boolean },
): Promise<PublicPaginated<PublicProperty>> {
  const params = parsePublicListParams(raw);
  return withCompanySlug(slug, () =>
    opts?.availableOnly
      ? publicUseCases.getAvailableProperties.execute(params)
      : publicUseCases.getProperties.execute(params),
  );
}

export async function getPublicPropertyByIdData(slug: string, id: string): Promise<PublicProperty | null> {
  return withCompanySlug(slug, () => publicUseCases.getPropertyById.execute(id));
}

export async function getPublicOwnersData(
  slug: string,
  raw: Record<string, unknown>,
): Promise<PublicPaginated<PublicOwner>> {
  const params = parsePublicListParams(raw, 50);
  return withCompanySlug(slug, () => publicUseCases.getOwners.execute(params));
}

export async function getPublicPropertyTypesData(
  slug: string,
  raw: Record<string, unknown>,
): Promise<PublicPaginated<PublicPropertyType>> {
  const params = parsePublicListParams(raw, 50);
  return withCompanySlug(slug, () => publicUseCases.getPropertyTypes.execute(params));
}

export async function getPublicAgenciesData(
  slug: string,
  raw: Record<string, unknown>,
): Promise<PublicPaginated<PublicAgency>> {
  const params = parsePublicListParams(raw, 50);
  return withCompanySlug(slug, () => publicUseCases.getAgencies.execute(params));
}