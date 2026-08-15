/**
 * Entidades de domínio: Imóvel (Property) + endereço, valores, IPTU e documentos.
 *
 * Escopo desta migração: apenas o fluxo "unificado" (`create-unified` /
 * `update-unified`), que é o único usado pelo frontend atual. O CRUD "normal"
 * (JSON puro, sem upload) e o endpoint separado de documentos existem no
 * backend mas não são chamados por nenhuma tela — não fazem parte do escopo.
 *
 * Camada: core.
 * Origem: models `Property`, `PropertyAddress`, `PropertyValue`, `PropertyIptu`,
 * `Document` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/PropertyService.ts.
 */

/** Endereço do imóvel. */
export interface PropertyAddressInput {
  zip_code: string;
  street: string;
  number: string;
  complement?: string | null;
  block?: string | null;
  lot?: string | null;
  district: string;
  city: string;
  state: string;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Dados financeiros/status do imóvel (PropertyValue). */
export interface PropertyValueInput {
  purchase_date?: string | Date | null;
  purchase_value?: number | null;
  market_value?: number | null;
  rental_value?: number | null;
  condo_fee?: number | null;
  property_tax?: number | null;
  status: string;
  notes?: string | null;
  sale_date?: string | Date | null;
  sale_value?: number | null;
  extra_charges?: number | null;
}

/** Lançamento de IPTU de um ano. `id` presente = atualiza; ausente = cria. */
export interface PropertyIptuInput {
  id?: string;
  year: number;
  property_tax?: number | null;
  property_tax_cash?: number | null;
  property_tax_cash_due_date?: string | Date | null;
  property_tax_first_installment?: number | null;
  property_tax_first_installment_due_date?: string | Date | null;
  property_tax_second_installment?: number | null;
  property_tax_second_installment_due_date?: string | Date | null;
  iptu_installments_count?: number | null;
  iptu_installments?: unknown;
  payment_condition?: string | null;
}

/** Registro de imóvel com relações carregadas (estrutura ampla — Prisma). */
export interface Property {
  id: string;
  title: string;
  registration_number?: string | null;
  bedrooms: number;
  bathrooms: number;
  half_bathrooms: number;
  garage_spaces: number;
  area_total: number;
  area_built: number;
  frontage: number;
  furnished: boolean;
  floor_number?: number | null;
  tax_registration: string;
  notes?: string | null;
  owner_id: string;
  type_id: string;
  agency_id?: string | null;
  center_id?: string | null;
  debit_center_id?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  iptu_refund_category_id?: string | null;
  iptu_refund_subcategory_id?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  addresses?: unknown[];
  owner?: unknown;
  type?: unknown;
  agency?: unknown;
  center?: unknown;
  debit_center?: unknown;
  category?: unknown;
  subcategory?: unknown;
  documents?: unknown[];
  values?: unknown[];
  iptus?: unknown[];
  leases?: unknown[];
  favorites?: unknown[];
  [key: string]: unknown;
}

/**
 * Dados de criação do fluxo unificado (`propertyData` do FormData, já com
 * `address`/`values`/`iptus` embutidos — como o front monta e o
 * PropertyValidator.validateCreate espera).
 */
export interface CreateUnifiedPropertyData {
  title: string;
  registration_number?: string | null;
  bedrooms: number;
  bathrooms: number;
  half_bathrooms?: number;
  garage_spaces?: number;
  area_total: number;
  area_built?: number;
  frontage?: number;
  furnished: boolean;
  floor_number?: number | null;
  tax_registration: string;
  notes?: string | null;
  owner_id: string;
  type_id: string;
  agency_id?: string | null;
  center_id?: string | null;
  debit_center_id?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  iptu_refund_category_id?: string | null;
  iptu_refund_subcategory_id?: string | null;
  address?: PropertyAddressInput;
  values?: PropertyValueInput;
  iptus?: PropertyIptuInput[];
}

export type UpdateUnifiedPropertyData = CreateUnifiedPropertyData;

/** Arquivo em memória, agrupado pelo campo de origem do FormData. */
export interface PropertyUploadFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

/** Campos de upload aceitos (mesmos nomes do FormData montado pelo front). */
export interface PropertyUploadFiles {
  arquivosImagens?: PropertyUploadFile[];
  arquivosMatricula?: PropertyUploadFile[];
  arquivosRegistro?: PropertyUploadFile[];
  arquivosEscritura?: PropertyUploadFile[];
  arquivosOutros?: PropertyUploadFile[];
}

export interface ListPropertiesParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedProperties {
  data: Property[];
  count: number;
  totalPages: number;
  currentPage: number;
}
