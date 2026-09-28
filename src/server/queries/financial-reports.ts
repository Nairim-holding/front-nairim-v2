import 'server-only';
import { financialTransactionUseCases } from '@/infra/factories/financial-transaction-factory';
import { withPermission } from '@/infra/auth/session';
import {
  expenseByCategoryQuerySchema,
  financialChartDetailQuerySchema,
  monthlySummaryMultiQuerySchema,
  monthlySummaryQuerySchema,
  parseMultiYears,
  subcategoryBreakdownQuerySchema,
} from '@/shared/validators/financial-reports';
import type {
  AvailableYearsResult,
  ExpenseByCategoryResult,
  MonthlySummary,
  MonthlySummaryMultiResult,
  SubcategoryBreakdownResult,
  TransactionDocument,
} from '@/core/entities/financial-transaction';
import type { FinancialChartDetailRow } from '@/core/entities/financial-chart-detail';

export async function getFinancialChartDetailsData(
  raw: Record<string, unknown>,
  filters?: Record<string, unknown>,
): Promise<FinancialChartDetailRow[]> {
  const query = financialChartDetailQuerySchema.parse(raw);
  return withPermission('financial-transactions', 'view', () =>
    financialTransactionUseCases.getChartDetails.execute(query, filters),
  );
}

/**
 * Queries (leitura) de relatórios financeiros e anexos de lançamento.
 * Guarda: `withTenant`. Camada: server.
 * Origem: TransactionController / DocumentController (GETs de agregação).
 */

export async function getMonthlySummaryData(
  raw: Record<string, unknown>,
): Promise<MonthlySummary> {
  const { year } = monthlySummaryQuerySchema.parse(raw);
  return withPermission('financial-transactions', 'view', () => financialTransactionUseCases.getMonthlySummary.execute(year, raw));
}

export async function getMonthlySummaryMultiData(
  raw: Record<string, unknown>,
): Promise<MonthlySummaryMultiResult> {
  monthlySummaryMultiQuerySchema.parse(raw);
  const years = parseMultiYears(raw);
  return withPermission('financial-transactions', 'view', () => financialTransactionUseCases.getMonthlySummaryMulti.execute(years, raw));
}

export async function getAvailableYearsData(): Promise<AvailableYearsResult> {
  return withPermission('financial-transactions', 'view', () => financialTransactionUseCases.getAvailableYears.execute());
}

export async function getExpenseByCategoryData(
  raw: Record<string, unknown>,
): Promise<ExpenseByCategoryResult> {
  const { startDate, endDate } = expenseByCategoryQuerySchema.parse(raw);
  return withPermission('financial-transactions', 'view', () =>
    financialTransactionUseCases.getExpenseByCategory.execute(new Date(startDate), new Date(endDate), raw),
  );
}

export async function getSubcategoryBreakdownData(
  raw: Record<string, unknown>,
): Promise<SubcategoryBreakdownResult> {
  const { categoryId, startDate, endDate } = subcategoryBreakdownQuerySchema.parse(raw);
  return withPermission('financial-transactions', 'view', () =>
    financialTransactionUseCases.getSubcategoryBreakdown.execute(categoryId, new Date(startDate), new Date(endDate), raw),
  );
}

export async function getTransactionDocumentsData(transactionId: string): Promise<TransactionDocument[]> {
  return withPermission('financial-transactions', 'view', () => financialTransactionUseCases.listDocuments.execute(transactionId));
}
