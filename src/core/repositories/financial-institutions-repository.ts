import type {
  BalanceSummaryItem,
  CreateFinancialInstitutionData,
  FinancialInstitution,
  ListFinancialInstitutionsParams,
  PaginatedFinancialInstitutions,
  UpdateFinancialInstitutionData,
} from '@/core/entities/financial-institution';

/**
 * Contrato de acesso a dados de Instituição Financeira.
 * Implementação Prisma: infra/repositories/prisma-financial-institutions-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.financialInstitution.*` em api-nairim-v2/src/services/FinancialIntitucion.ts.
 */
export interface FinancialInstitutionsRepository {
  list(params: ListFinancialInstitutionsParams): Promise<PaginatedFinancialInstitutions>;
  getFilters(): Promise<Record<string, unknown>>;
  /** Instituição por ID (não excluída), ou `null`. */
  findById(id: string): Promise<FinancialInstitution | null>;
  create(data: CreateFinancialInstitutionData): Promise<FinancialInstitution>;
  update(id: string, data: UpdateFinancialInstitutionData): Promise<FinancialInstitution>;
  /**
   * Soft-delete. Lança conflito (409) se existirem transações não-excluídas
   * vinculadas (comportamento fiel do backend: mensagem exata preservada).
   */
  softDelete(id: string): Promise<FinancialInstitution>;
  findDeletionState(id: string): Promise<{ deleted_at: Date | null } | null>;
  restore(id: string): Promise<FinancialInstitution>;
  /** find-or-create insensível a maiúsculas pelo nome (retorna existente se houver). */
  quickCreate(data: { name: string }): Promise<FinancialInstitution>;
  /** Saldo por conta: receitas COMPLETED - despesas COMPLETED por instituição. */
  getBalanceSummary(): Promise<BalanceSummaryItem[]>;
}