import { prismaFinancialReportsRepository } from '@/infra/repositories/prisma-financial-reports-repository';
import {
  GetGroupedReportUseCase,
  GetExtratoReportUseCase,
  GetIncomeExpenseReportUseCase,
  GetDemonstrativoReportUseCase,
} from '@/core/use-cases/financial-report/aggregations';

/** Composition root do módulo Relatórios Financeiros. Camada: infra. */
export const financialReportUseCases = {
  getGrouped: new GetGroupedReportUseCase(prismaFinancialReportsRepository),
  getExtrato: new GetExtratoReportUseCase(prismaFinancialReportsRepository),
  getIncomeExpense: new GetIncomeExpenseReportUseCase(prismaFinancialReportsRepository),
  getDemonstrativo: new GetDemonstrativoReportUseCase(prismaFinancialReportsRepository),
};
