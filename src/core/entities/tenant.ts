/**
 * Entidades de domínio: Inquilino (Tenant) + endereço + contatos.
 *
 * ⚠️ FIDELIDADE AO BACKEND: diferente de Owner, o TenantService NÃO aplica
 * exclusão mútua PF/PJ (não zera os campos do "lado oposto" ao gravar). Os
 * campos cpf/cnpj/rg/nationality/occupation/marital_status/state_registration/
 * municipal_registration são gravados exatamente como recebidos. Preservado
 * assim de propósito — ver nota no use-case de create/update.
 *
 * Camada: core.
 * Origem: model `Tenant` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/TenantService.ts.
 */

import type { ContactChannel } from './contact-channel';

export interface TenantContactInput {
  contact?: string | null;
  phone?: string | null;
  cellphone?: string | null;
  email?: string | null;
  /** Telefones/e-mails adicionais (Etapa 3). O principal fica nos campos acima. */
  channels?: ContactChannel[];
}

export interface TenantAddressInput {
  zip_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

/** Registro de inquilino (com relações carregadas). */
export interface Tenant {
  id: string;
  name: string;
  internal_code: string;
  nationality?: string | null;
  occupation?: string | null;
  marital_status?: string | null;
  cpf?: string | null;
  rg?: string | null;
  rg_issuing_body?: string | null;
  rg_issuing_state?: string | null;
  cnpj?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  addresses?: unknown[];
  contacts?: unknown[];
  leases?: unknown[];
  [key: string]: unknown;
}

/** Dados de criação. Todos os campos de PF/PJ são gravados como recebidos (sem nulling). */
export interface CreateTenantData {
  name: string;
  internal_code: string;
  nationality?: string | null;
  occupation?: string | null;
  marital_status?: string | null;
  cpf?: string | null;
  rg?: string | null;
  rg_issuing_body?: string | null;
  rg_issuing_state?: string | null;
  cnpj?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  contacts?: TenantContactInput[];
  addresses?: TenantAddressInput[];
}

export type UpdateTenantData = Partial<CreateTenantData>;

export interface ListTenantsParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedTenants {
  data: Tenant[];
  count: number;
  totalPages: number;
  currentPage: number;
}
