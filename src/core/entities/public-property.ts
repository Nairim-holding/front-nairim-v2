/**
 * Entidades da vitrine PÚBLICA (`/public/:companySlug`).
 *
 * Origem: api-nairim-v2/src/services/PublicService.ts (seleção `PUBLIC_PROPERTY_SELECT`).
 * O public expõe APENAS campos de vitrine: não há endereços completos (apenas
 * street/number/district/city/state/country), documentos somente com tipo 'IMAGE'
 * (mídia) e o valor mais recente de cada imóvel.
 *
 * Camada: core.
 */

/** Parâmetros de listagem pública (espelha `PublicListParams` do backend). */
export interface PublicListParams {
  limit?: number;
  page?: number;
  search?: string;
}

/** Paginação das listas públicas (`{ items, meta }` — envelope do backend). */
export interface PublicPaginated<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    /** `limit` efetivamente aplicado (já clampeado entre 1 e 100). */
    limit: number;
    totalPages: number;
  };
}

/** Endereço resumido exposto na vitrine (via junction `PropertyAddress`). */
export interface PublicPropertyAddress {
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

/** Documento de imagem exposto (apenas `type: 'IMAGE'` e não deletado). */
export interface PublicPropertyDocument {
  id: string;
  file_path: string | null;
  description: string | null;
  is_featured: boolean;
}

/** Valor mais recente do imóvel (um registro por imóvel). */
export interface PublicPropertyValue {
  status: string | null;
  rental_value: string | null;
  sale_value: string | null;
  condo_fee: string | null;
  property_tax: string | null;
}

/** Imóvel público (shape do `PUBLIC_PROPERTY_SELECT` do backend). */
export interface PublicProperty {
  id: string;
  title: string;
  registration_number: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  half_bathrooms: number | null;
  garage_spaces: number | null;
  area_total: string | null;
  area_built: string | null;
  frontage: string | null;
  furnished: boolean | null;
  floor_number: number | null;
  notes: string | null;
  created_at: Date;
  type: { id: string; description: string } | null;
  agency: { id: string; trade_name: string } | null;
  addresses: { address: PublicPropertyAddress | null }[];
  documents: PublicPropertyDocument[];
  values: PublicPropertyValue[];
}

/** Proprietário exposto na vitrine (nome + código interno). */
export interface PublicOwner {
  id: string;
  name: string;
  internal_code: string | null;
}

/** Tipo de imóvel exposto. */
export interface PublicPropertyType {
  id: string;
  description: string;
}

/** Imobiliária exposta. */
export interface PublicAgency {
  id: string;
  trade_name: string;
}

/** Empresa resolvida pelo slug (para o tenant público). */
export interface PublicCompany {
  id: string;
  name: string;
  slug: string;
}