import type { FinancialReportsRepository } from '@/core/repositories/financial-reports-repository';
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
 * Casos de uso dos Relatórios Financeiros — leitura/agregação pura, sem
 * regra de negócio adicional além de delegar ao repositório (mesmo padrão do
 * módulo Dashboard). Validação de entrada (Zod) fica em shared/validators.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/controllers/ReportController.ts.
 */

export class GetGroupedReportUseCase {
  constructor(private readonly repo: FinancialReportsRepository) {}
  execute(params: ReportParams, groupBy: ReportGroupBy): Promise<GroupedReportResult> {
    return this.repo.getGrouped(params, groupBy);
  }
}

export class GetExtratoReportUseCase {
  constructor(private readonly repo: FinancialReportsRepository) {}
  execute(params: ReportParams): Promise<ExtratoResult> {
    return this.repo.getExtrato(params);
  }
}

export class GetIncomeExpenseReportUseCase {
  constructor(private readonly repo: FinancialReportsRepository) {}
  execute(params: ReportParams): Promise<IncomeExpenseResult> {
    return this.repo.getIncomeExpense(params);
  }
}

export class GetDemonstrativoReportUseCase {
  constructor(private readonly repo: FinancialReportsRepository) {}
  execute(params: ReportParams, groupBy: DfcGroupBy): Promise<DemonstrativoResult> {
    return this.repo.getDemonstrativo(params, groupBy);
  }
}
