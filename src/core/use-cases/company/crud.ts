import type { CompaniesRepository } from '@/core/repositories/companies-repository';
import type { BrandingData, CompanyListResult, CompanyWithBranding } from '@/core/entities/company';
import { ValidationError, NotFoundError, ConflictError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de CRUD de Empresa.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/CompanyService.ts + CompanyController.
 */

/** Verifica disponibilidade de slug. Origem: checkSlugAvailability. */
export class CheckSlugAvailabilityUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(slugRaw: string): Promise<{ available: boolean }> {
    const slug = String(slugRaw ?? '').toLowerCase().trim();
    if (!slug) throw new ValidationError('Slug é obrigatório');
    const exists = await this.companies.checkSlugExists(slug);
    return { available: !exists };
  }
}

/** Lista empresas paginadas. Origem: listCompanies. */
export class ListCompaniesUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(params: { page?: number; limit?: number; search?: string; includeInactive?: boolean }): Promise<CompanyListResult> {
    return this.companies.list({
      page: params.page ?? 1,
      limit: params.limit ?? 30,
      search: params.search ?? '',
      includeInactive: params.includeInactive ?? false,
    });
  }
}

/** Busca empresa por ID (com branding). Origem: getCompanyById. */
export class GetCompanyByIdUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(id: string): Promise<CompanyWithBranding> {
    const company = await this.companies.findByIdWithBranding(id);
    if (!company) throw new NotFoundError('Empresa não encontrada');
    return company;
  }
}

/** Cria empresa. Origem: createCompany. */
export class CreateCompanyUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(data: { name?: string; slug?: string } & BrandingData): Promise<CompanyWithBranding> {
    const { name, slug: slugRaw, ...branding } = data;
    if (!name || !slugRaw) throw new ValidationError('name e slug são obrigatórios');

    const slug = String(slugRaw).toLowerCase().trim();
    if (await this.companies.checkSlugExists(slug)) {
      throw new ConflictError('Já existe uma empresa com este slug');
    }
    return this.companies.create({ name, slug, ...branding });
  }
}

/** Atualiza empresa. Origem: updateCompany. */
export class UpdateCompanyUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(id: string, data: { name?: string; slug?: string; is_active?: boolean } & BrandingData): Promise<CompanyWithBranding> {
    const existing = await this.companies.findByIdWithBranding(id);
    if (!existing) throw new NotFoundError('Empresa não encontrada');

    const { slug: slugRaw, ...rest } = data;
    const slug = slugRaw ? String(slugRaw).toLowerCase().trim() : undefined;

    if (slug && slug !== existing.slug && (await this.companies.slugExistsExcept(slug, id))) {
      throw new ConflictError('Já existe uma empresa com este slug');
    }
    return this.companies.update(id, { ...rest, ...(slug ? { slug } : {}) });
  }
}

/** Desativa (soft-delete) empresa. Origem: deleteCompany. */
export class DeleteCompanyUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(id: string): Promise<void> {
    const existing = await this.companies.findByIdWithBranding(id);
    if (!existing) throw new NotFoundError('Empresa não encontrada');
    await this.companies.softDelete(id);
  }
}

/** Reativa empresa. Origem: restoreCompany. */
export class RestoreCompanyUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(id: string): Promise<CompanyWithBranding> {
    return this.companies.restore(id);
  }
}
