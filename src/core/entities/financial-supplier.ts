/**
 * Entidades de domínio: Fornecedor (Supplier).
 *
 * Fidelidade ao backend: `getSuppliers`/`deleteSupplier` no Express não recebiam
 * `company_id` nas leituras; na migração `Supplier` está em TENANT_MODELS e a
 * extensão injeta `company_id` nas leituras (comportamento escopado, mesmo
 * padrão de Card). Dup de CNPJ/CPF no create vira 409 com mensagem em pt-BR
 * (no backend o CPF caía em 400 "Erro: CPF already registered" — normalizado).
 * `deleteSupplier` soft-deleta supplier + contatos + endereços vinculados, sem
 * checagem de transações (fiel ao backend).
 *
 * Camada: core.
 * Origem: model `Supplier`/`Contact`/`Address`/`SupplierAddress`
 * (prisma/schema.prisma) e api-nairim-v2/src/services/SupplierService.ts.
 */

export interface SupplierContactInput {
  contact?: string | null;
  phone?: string | null;
  cellphone?: string | null;
  email?: string | null;
}

export interface SupplierAddressInput {
  zip_code: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  country?: string | null;
  block?: string | null;
  lot?: string | null;
}

export interface AddressRecord {
  id: string;
  zip_code: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  country: string;
  complement?: string | null;
}

export interface SupplierAddressRecord {
  id: string;
  address_id: string;
  address?: AddressRecord | null;
}

export interface SupplierContactRecord {
  id: string;
  contact?: string | null;
  phone?: string | null;
  cellphone?: string | null;
  email?: string | null;
}

export interface Supplier {
  id: string;
  company_id: string;
  sequential_id: number;
  legal_name: string;
  trade_name: string | null;
  cnpj: string | null;
  cpf: string | null;
  state_registration: string | null;
  municipal_registration: string | null;
  internal_code: string | null;
  created_via: string | null;
  is_active: boolean;
  marital_status: string | null;
  occupation: string | null;
  addresses?: SupplierAddressRecord[];
  contacts?: SupplierContactRecord[];
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateSupplierData {
  legal_name: string;
  trade_name?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  internal_code?: string | null;
  occupation?: string | null;
  marital_status?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  addresses?: SupplierAddressInput[];
  contacts?: SupplierContactInput[];
}

export interface UpdateSupplierData {
  legal_name?: string;
  trade_name?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  internal_code?: string | null;
  occupation?: string | null;
  marital_status?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  addresses?: SupplierAddressInput[];
  contacts?: SupplierContactInput[];
}

export interface ListSuppliersParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedSuppliers {
  data: Supplier[];
  count: number;
  totalPages: number;
  currentPage: number;
}