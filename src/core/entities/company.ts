/**
 * Entidades de domínio: Empresa (tenant) e seu Branding (white-label).
 *
 * Camada: core.
 * Origem: models `Company` / `CompanyBranding` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/CompanyService.ts.
 */

/**
 * Campos de branding aceitos em create/update de empresa e no update de
 * branding. Idêntico à lista `BRANDING_FIELDS` do CompanyController do backend.
 */
export const BRANDING_FIELDS = [
  'primary_color', 'secondary_color', 'company_name', 'company_info', 'logo_url', 'favicon_url',
  'trade_name', 'app_title', 'app_description', 'logo_sidebar_url', 'logo_dark_url', 'og_image_url',
  'accent_color', 'success_color', 'warning_color', 'error_color', 'info_color',
  'bg_color', 'card_color', 'border_color', 'text_color',
  'primary_color_dark', 'secondary_color_dark', 'accent_color_dark', 'success_color_dark',
  'warning_color_dark', 'error_color_dark', 'info_color_dark',
  'bg_color_dark', 'card_color_dark', 'border_color_dark', 'text_color_dark',
] as const;

export type BrandingField = (typeof BRANDING_FIELDS)[number];

/** Dados parciais de branding (apenas os campos presentes são atualizados). */
export type BrandingData = Partial<Record<BrandingField, unknown>>;

/** Campo de asset de branding (imagem) que pode ser enviado por upload. */
export type BrandingAssetField =
  | 'logo_url' | 'favicon_url' | 'logo_sidebar_url' | 'logo_dark_url' | 'og_image_url';

/** Empresa (tenant). */
export interface Company {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/** Branding de uma empresa (linha de CompanyBranding). Campos dinâmicos. */
export interface CompanyBranding {
  company_id: string;
  [key: string]: unknown;
}

/** Empresa com o branding incluído. */
export interface CompanyWithBranding extends Company {
  branding: CompanyBranding | null;
}

/** Retorno do branding público por slug (empresa + branding). */
export interface PublicBranding {
  company: Company & { branding?: CompanyBranding | null };
  branding: CompanyBranding | null;
}

/** Resultado paginado da listagem de empresas (formato flat do DataTable). */
export interface CompanyListResult {
  data: CompanyWithBranding[];
  count: number;
  totalPages: number;
  currentPage: number;
}
