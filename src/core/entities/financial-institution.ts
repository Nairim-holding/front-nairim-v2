/**
 * Entidades de domínio: Instituição Financeira (FinancialInstitution).
 *
 * Fidelidade ao backend: o `FinancialInstitutionService` faz scoping por
 * empresa via extensão do Prisma (não recebe `company_id` em todos os métodos,
 * mas `create`/`quickCreate` recebem e conectam `company`). `name` é filtrado
 * por igualdade exata; bank/agency/account por contains insensitive.
 *
 * Camada: core.
 * Origem: model `FinancialInstitution` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/FinancialIntitucion.ts.
 */

/** Registro de instituição financeira. */
export interface FinancialInstitution {
  id: string;
  company_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  is_active: boolean;
  account_number: string | null;
  agency_number: string | null;
  bank_number: string | null;
  [key: string]: unknown;
}

/** Dados de criação (todas as strings opcionais viram null no create). */
export interface CreateFinancialInstitutionData {
  name: string;
  bank_number?: string | null;
  agency_number?: string | null;
  account_number?: string | null;
  is_active?: boolean;
}

export type UpdateFinancialInstitutionData = Partial<CreateFinancialInstitutionData>;

export interface ListFinancialInstitutionsParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedFinancialInstitutions {
  data: FinancialInstitution[];
  count: number;
  totalPages: number;
  currentPage: number;
}

/** Item do resumo de saldo por conta (GET /financial-institution/balance-summary). */
export interface BalanceSummaryItem {
  institutionId: string;
  name: string;
  balance: number;
}