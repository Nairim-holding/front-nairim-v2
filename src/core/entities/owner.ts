/**
 * Entidades de domínio: Proprietário (Owner) + endereço + contatos.
 *
 * Pessoa Física (CPF) e Pessoa Jurídica (CNPJ) são mutuamente exclusivas: ao
 * gravar um Owner como PF, os campos de PJ são zerados (e vice-versa) — regra
 * aplicada no use-case, replicando o backend.
 *
 * Camada: core.
 * Origem: model `Owner` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/OwnerService.ts.
 */

export interface OwnerContactInput {
  contact?: string | null;
  phone?: string | null;
  cellphone?: string | null;
  email?: string | null;
}

export interface OwnerAddressInput {
  zip_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

/** Registro de proprietário (com relações carregadas). */
export interface Owner {
  id: string;
  name: string;
  internal_code: string;
  occupation?: string | null;
  marital_status?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  addresses?: unknown[];
  contacts?: unknown[];
  properties?: unknown[];
  leases?: unknown[];
  [key: string]: unknown;
}

/** Dados de criação — PF via `cpf`, PJ via `cnpj` (mutuamente exclusivos). */
export interface CreateOwnerData {
  name: string;
  internal_code: string;
  // Pessoa Física
  occupation?: string | null;
  marital_status?: string | null;
  cpf?: string | null;
  // Pessoa Jurídica
  cnpj?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  contacts?: OwnerContactInput[];
  addresses?: OwnerAddressInput[];
}

export type UpdateOwnerData = Partial<CreateOwnerData>;

export interface ListOwnersParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedOwners {
  data: Owner[];
  count: number;
  totalPages: number;
  currentPage: number;
}
