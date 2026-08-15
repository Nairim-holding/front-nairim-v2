import type {
  PublicAgency,
  PublicCompany,
  PublicOwner,
  PublicPaginated,
  PublicProperty,
  PublicPropertyType,
  PublicListParams,
} from '@/core/entities/public-property';

/**
 * Contrato de acesso à vitrine PÚBLICA (`/public/:companySlug`).
 *
 * Implementação Prisma: infra/repositories/prisma-public-repository.ts.
 * Observação de multi-tenancy: todos os métodos assumem que o chamador já
 * resolveu a empresa e rodou `runWithTenant(companyId)` — a extensão Prisma
 * injeta `company_id` automaticamente.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/PublicService.ts.
 */
export interface PublicRepository {
  /** Empresa ativa (não excluída) pelo slug, ou `null`. (resolveCompanyBySlug) */
  getCompanyBySlug(slug: string): Promise<PublicCompany | null>;

  /** Lista imóveis públicos. `onlyAvailable` filtra por value.status='AVAILABLE'. */
  getProperties(params: PublicListParams & { onlyAvailable?: boolean }): Promise<PublicPaginated<PublicProperty>>;

  /** Imóvel público por ID (do tenant em contexto), ou `null`. */
  getPropertyById(id: string): Promise<PublicProperty | null>;

  /** Lista proprietários públicos. */
  getOwners(params: PublicListParams): Promise<PublicPaginated<PublicOwner>>;

  /** Lista tipos de imóvel públicos. */
  getPropertyTypes(params: PublicListParams): Promise<PublicPaginated<PublicPropertyType>>;

  /** Lista imobiliárias públicas. */
  getAgencies(params: PublicListParams): Promise<PublicPaginated<PublicAgency>>;
}