import type {
  DemonstrativoResult,
  DfcGroupBy,
  ExtratoResult,
  GroupedReportResult,
  IncomeExpenseResult,
  ReportGroupBy,
  ReportParams,
} from '@/core/entities/financial-report';

/**
 * Contrato de leitura dos Relatórios Financeiros — read-only, um método por
 * relatório (mesmo molde do módulo Dashboard: leitura/agregação pura, sem
 * CRUD).
 * Implementação Prisma: infra/repositories/prisma-financial-reports-repository.ts.
 * Tenant-scoped: `Transaction` está em TENANT_MODELS.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/ReportService.ts.
 */
export interface FinancialReportsRepository {
  getGrouped(params: ReportParams, groupBy: ReportGroupBy): Promise<GroupedReportResult>;
  getExtrato(params: ReportParams): Promise<ExtratoResult>;
  /** Ignora `params.type` internamente — sempre calcula os dois lados (receita e despesa). */
  getIncomeExpense(params: ReportParams): Promise<IncomeExpenseResult>;
  /** Ignora `params.type` internamente — sempre calcula os dois lados. */
  getDemonstrativo(params: ReportParams, groupBy: DfcGroupBy): Promise<DemonstrativoResult>;
}
