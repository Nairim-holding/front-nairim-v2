import type {
  BrandingAssetField,
  BrandingData,
  CompanyBranding,
  CompanyListResult,
  CompanyWithBranding,
  PublicBranding,
} from '@/core/entities/company';

/**
 * Contrato de acesso a dados de Empresa (tenant) + Branding.
 *
 * Implementação Prisma: infra/repositories/prisma-companies-repository.ts.
 *
 * Camada: core.
 * Origem: `prisma.company.*` / `prisma.companyBranding.*` em
 * api-nairim-v2/src/services/CompanyService.ts.
 */
export interface CompaniesRepository {
  /** Slug da empresa pelo ID, ou `null`. (Usado no login — Módulo 2.) */
  findSlugById(id: string): Promise<string | null>;

  // ─── Validação de slug ──────────────────────────────────────────────────
  /** Existe empresa com este slug? */
  checkSlugExists(slug: string): Promise<boolean>;
  /** Existe outra empresa (id != exceptId) com este slug? */
  slugExistsExcept(slug: string, exceptId: string): Promise<boolean>;

  // ─── Branding ───────────────────────────────────────────────────────────
  /** Branding público por slug (empresa ativa e não excluída), ou `null`. */
  getBrandingBySlug(slug: string): Promise<PublicBranding | null>;
  /** Branding da empresa por ID (linha de CompanyBranding), ou `null`. */
  getBrandingByCompanyId(companyId: string): Promise<CompanyBranding | null>;
  /** Cria/atualiza o branding da empresa com os campos informados. */
  upsertBranding(companyId: string, data: BrandingData): Promise<CompanyBranding>;
  /** Grava a URL de um asset (logo/favicon/...) no branding e retorna a URL. */
  upsertBrandingAsset(companyId: string, field: BrandingAssetField, url: string): Promise<string>;

  // ─── CRUD ───────────────────────────────────────────────────────────────
  /** Lista paginada (formato flat do DataTable). */
  list(params: { page: number; limit: number; search: string; includeInactive: boolean }): Promise<CompanyListResult>;
  /** Empresa por ID com branding, ou `null`. */
  findByIdWithBranding(id: string): Promise<CompanyWithBranding | null>;
  /** Cria empresa (+ branding aninhado, se houver). */
  create(data: { name: string; slug: string } & BrandingData): Promise<CompanyWithBranding>;
  /** Atualiza empresa (+ branding aninhado, se houver). */
  update(id: string, data: { name?: string; slug?: string; is_active?: boolean } & BrandingData): Promise<CompanyWithBranding>;
  /** Soft-delete (deleted_at + is_active=false). */
  softDelete(id: string): Promise<void>;
  /** Reativa (deleted_at=null + is_active=true). */
  restore(id: string): Promise<CompanyWithBranding>;
}
