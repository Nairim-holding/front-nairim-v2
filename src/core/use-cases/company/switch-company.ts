import type { CompaniesRepository } from '@/core/repositories/companies-repository';
import type { TokenSigner } from '@/core/cryptography/token-signer';
import { ValidationError, NotFoundError } from '@/core/errors/domain-errors';

/** Dados do usuário atual necessários para reemitir o token. */
export interface SwitchCompanyUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Saída do switch (novo token + contexto de empresa). */
export interface SwitchCompanyOutput {
  token: string;
  user: SwitchCompanyUser & { company_id: string; company_slug: string };
  company: { id: string; name: string; slug: string };
}

/**
 * Caso de uso: trocar o contexto de empresa emitindo um novo JWT com o
 * `company_id` da empresa destino — sem re-login.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/controllers/CompanyController.ts → switchCompany.
 */
export class SwitchCompanyUseCase {
  constructor(
    private readonly companies: CompaniesRepository,
    private readonly tokenSigner: TokenSigner,
    private readonly sessionTtl: string,
  ) {}

  async execute(currentUser: SwitchCompanyUser, slug: string): Promise<SwitchCompanyOutput> {
    if (!slug?.trim()) throw new ValidationError('"slug" é obrigatório');

    // Company não é tenant-scoped → busca ignora o filtro de empresa. Exige ativa.
    const target = await this.companies.getBrandingBySlug(slug);
    if (!target?.company) throw new NotFoundError('Empresa não encontrada ou inativa');

    const company = target.company;
    const token = this.tokenSigner.sign(
      {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        company_id: company.id,
      },
      { expiresIn: this.sessionTtl },
    );

    return {
      token,
      user: { ...currentUser, company_id: company.id, company_slug: company.slug },
      company: { id: company.id, name: company.name, slug: company.slug },
    };
  }
}
