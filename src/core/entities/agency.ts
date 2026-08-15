/**
 * Entidades de domínio: Imobiliária (Agency) + endereço + contatos.
 *
 * Camada: core.
 * Origem: models `Agency`, `AgencyAddress`, `Address`, `Contact`
 * (prisma/schema.prisma) e api-nairim-v2/src/services/AgencyService.ts.
 */

/** Contato de uma imobiliária. */
export interface AgencyContactInput {
  contact?: string | null;
  phone?: string | null;
  cellphone?: string | null;
  email?: string | null;
}

/** Endereço enviado no cadastro/edição. */
export interface AgencyAddressInput {
  zip_code?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

/** Registro de imobiliária (com relações carregadas). Estrutura ampla (Prisma). */
export interface Agency {
  id: string;
  trade_name: string;
  legal_name: string;
  cnpj: string;
  state_registration?: string | null;
  municipal_registration?: string | null;
  license_number?: string | null;
  commission_category_id?: string | null;
  commission_subcategory_id?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  addresses?: unknown[];
  contacts?: unknown[];
  [key: string]: unknown;
}

/** Dados de criação de imobiliária. */
export interface CreateAgencyData {
  trade_name: string;
  legal_name: string;
  cnpj: string;
  state_registration?: string | null;
  municipal_registration?: string | null;
  license_number?: string | null;
  commission_category_id?: string | null;
  commission_subcategory_id?: string | null;
  contacts?: AgencyContactInput[];
  addresses?: AgencyAddressInput[];
}

/** Dados de atualização (todos opcionais; contacts/addresses substituem os atuais). */
export type UpdateAgencyData = Partial<CreateAgencyData>;

/** Parâmetros de listagem. */
export interface ListAgenciesParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

/** Resultado paginado (formato flat do DataTable). */
export interface PaginatedAgencies {
  data: Agency[];
  count: number;
  totalPages: number;
  currentPage: number;
}

/** Sugestão de contato (autocomplete de cadastro). */
export interface ContactSuggestion {
  contact: string | null;
  phone: string | null;
  cellphone: string | null;
  email: string | null;
}
