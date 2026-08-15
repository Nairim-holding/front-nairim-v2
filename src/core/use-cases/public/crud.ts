import type { PublicRepository } from '@/core/repositories/public-repository';
import type {
  PublicAgency,
  PublicCompany,
  PublicListParams,
  PublicOwner,
  PublicPaginated,
  PublicProperty,
  PublicPropertyType,
} from '@/core/entities/public-property';

/**
 * Use-cases da vitrine PÚBLICA (`/public/:companySlug`).
 * Fonte fiel: api-nairim-v2/src/services/PublicService.ts (métodos estáticos).
 *
 * Observação de tenant: os use-cases NÃO resolvem a empresa — a camada de
 * queries já resolveu o slug e abriu `runWithTenant(companyId)` (equivale ao
 * middleware `resolveCompanyBySlug` do backend). A extensão Prisma injeta o
 * `company_id`.
 *
 * Camada: core.
 */

/** Resolve a empresa ativa pelo slug (`resolveCompanyBySlug` do backend). */
export class GetPublicCompanyBySlugUseCase {
  constructor(private readonly repo: PublicRepository) {}

  execute(slug: string): Promise<PublicCompany | null> {
    return this.repo.getCompanyBySlug(slug);
  }
}

/** GET /public/:slug/properties/available */
export class GetAvailablePropertiesUseCase {
  constructor(private readonly repo: PublicRepository) {}

  execute(params: PublicListParams): Promise<PublicPaginated<PublicProperty>> {
    return this.repo.getProperties({ ...params, onlyAvailable: true });
  }
}

/** GET /public/:slug/properties */
export class GetPublicPropertiesUseCase {
  constructor(private readonly repo: PublicRepository) {}

  execute(params: PublicListParams): Promise<PublicPaginated<PublicProperty>> {
    return this.repo.getProperties(params);
  }
}

/** GET /public/:slug/properties/:id */
export class GetPublicPropertyByIdUseCase {
  constructor(private readonly repo: PublicRepository) {}

  execute(id: string): Promise<PublicProperty | null> {
    return this.repo.getPropertyById(id);
  }
}

/** GET /public/:slug/owners */
export class GetPublicOwnersUseCase {
  constructor(private readonly repo: PublicRepository) {}

  execute(params: PublicListParams): Promise<PublicPaginated<PublicOwner>> {
    return this.repo.getOwners(params);
  }
}

/** GET /public/:slug/property-types */
export class GetPublicPropertyTypesUseCase {
  constructor(private readonly repo: PublicRepository) {}

  execute(params: PublicListParams): Promise<PublicPaginated<PublicPropertyType>> {
    return this.repo.getPropertyTypes(params);
  }
}

/** GET /public/:slug/agencies */
export class GetPublicAgenciesUseCase {
  constructor(private readonly repo: PublicRepository) {}

  execute(params: PublicListParams): Promise<PublicPaginated<PublicAgency>> {
    return this.repo.getAgencies(params);
  }
}