import 'server-only';
import { financialTransactionUseCases } from '@/infra/factories/financial-transaction-factory';
import { withTenant } from '@/infra/auth/session';
import {
  expenseByCategoryQuerySchema,
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

/**
 * Queries (leitura) de relatórios financeiros e anexos de lançamento.
 * Guarda: `withTenant`. Camada: server.
 * Origem: TransactionController / DocumentController (GETs de agregação).
 */

export async function getMonthlySummaryData(
  raw: Record<string, unknown>,
): Promise<MonthlySummary> {
  const { year } = monthlySummaryQuerySchema.parse(raw);
  return withTenant(() => financialTransactionUseCases.getMonthlySummary.execute(year, raw));
}

export async function getMonthlySummaryMultiData(
  raw: Record<string, unknown>,
): Promise<MonthlySummaryMultiResult> {
  monthlySummaryMultiQuerySchema.parse(raw);
  const years = parseMultiYears(raw);
  return withTenant(() => financialTransactionUseCases.getMonthlySummaryMulti.execute(years, raw));
}

export async function getAvailableYearsData(): Promise<AvailableYearsResult> {
  return withTenant(() => financialTransactionUseCases.getAvailableYears.execute());
}

export async function getExpenseByCategoryData(
  raw: Record<string, unknown>,
): Promise<ExpenseByCategoryResult> {
  const { startDate, endDate } = expenseByCategoryQuerySchema.parse(raw);
  return withTenant(() =>
    financialTransactionUseCases.getExpenseByCategory.execute(new Date(startDate), new Date(endDate), raw),
  );
}

export async function getSubcategoryBreakdownData(
  raw: Record<string, unknown>,
): Promise<SubcategoryBreakdownResult> {
  const { categoryId, startDate, endDate } = subcategoryBreakdownQuerySchema.parse(raw);
  return withTenant(() =>
    financialTransactionUseCases.getSubcategoryBreakdown.execute(categoryId, new Date(startDate), new Date(endDate), raw),
  );
}

export async function getTransactionDocumentsData(transactionId: string): Promise<TransactionDocument[]> {
  return withTenant(() => financialTransactionUseCases.listDocuments.execute(transactionId));
}