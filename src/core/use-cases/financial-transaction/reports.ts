import type { TransactionsRepository } from '@/core/repositories/financial-transactions-repository';
import type {
  AvailableYearsResult,
  ExpenseByCategoryResult,
  MonthlySummary,
  MonthlySummaryMultiResult,
  SubcategoryBreakdownResult,
  TransactionEntityFilters,
} from '@/core/entities/financial-transaction';
import { ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de relatórios financeiros (agregações usadas pelos gráficos do
 * Dashboard). Camada: core. Origem: TransactionService.getMonthlyIncomeExpenseSummary,
 * getMonthlyIncomeExpenseSummaryMulti, getAvailableYears, getExpenseByCategory
 * e getSubcategoryBreakdown + controllers correspondentes.
 *
 * Fidelidade: validações replicam as dos controllers do backend
 * (`?year=`, `?years=`, `startDate`/`endDate`/`categoryId` obrigatórios).
 */

function parseFilters(raw?: Record<string, unknown>): TransactionEntityFilters {
  const filters: TransactionEntityFilters = {};
  if (!raw) return filters;
  const FIELDS = [
    'category_id',
    'subcategory_id',
    'financial_institution_id',
    'card_id',
    'center_id',
    'supplier_id',
  ] as const;
  for (const field of FIELDS) {
    if (raw[field] === undefined) continue;
    const values = (Array.isArray(raw[field]) ? raw[field] : [raw[field]])
      .map((v) => String(v))
      .filter(Boolean);
    if (values.length > 0) (filters as Record<string, string[]>)[field] = values;
  }
  if (raw.description !== undefined) {
    const values = (Array.isArray(raw.description) ? raw.description : [raw.description])
      .map((v) => String(v))
      .filter(Boolean);
    if (values.length > 0) filters.description = values;
  }
  return filters;
}

/** GET /monthly-summary?year=YYYY - resumo mensal de um ano. */
export class GetMonthlySummaryUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}

  async execute(year: number, rawFilters?: Record<string, unknown>): Promise<MonthlySummary> {
    const normalizedYear = Number(year);
    if (Number.isNaN(normalizedYear)) throw new ValidationError('O ano informado é inválido');
    return this.transactions.getMonthlySummary(normalizedYear, parseFilters(rawFilters));
  }
}

/** GET /monthly-summary-multi?years=YYYY&years=YYYY - resumo de vários anos. */
export class GetMonthlySummaryMultiUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}

  async execute(years: number[], rawFilters?: Record<string, unknown>): Promise<MonthlySummaryMultiResult> {
    if (!years || years.length === 0) {
      throw new ValidationError('Informe ao menos um ano em "years" ou "year"');
    }
    const normalized = years.map((y) => Number(y)).filter((y) => !Number.isNaN(y));
    if (normalized.length === 0) throw new ValidationError('Informe ao menos um ano em "years" ou "year"');
    return this.transactions.getMonthlySummaryMulti(normalized, parseFilters(rawFilters));
  }
}

/** GET /available-years - anos com lançamentos cadastrados. */
export class GetAvailableYearsUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}

  async execute(): Promise<AvailableYearsResult> {
    return this.transactions.getAvailableYears();
  }
}

/** GET /expense-by-category?startDate=&endDate= - despesas por categoria. */
export class GetExpenseByCategoryUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}

  async execute(startDate: Date, endDate: Date, rawFilters?: Record<string, unknown>): Promise<ExpenseByCategoryResult> {
    return this.transactions.getExpenseByCategory(startDate, endDate, parseFilters(rawFilters));
  }
}

/** GET /subcategory-breakdown?categoryId=&startDate=&endDate=. */
export class GetSubcategoryBreakdownUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}

  async execute(
    categoryId: string,
    startDate: Date,
    endDate: Date,
    rawFilters?: Record<string, unknown>,
  ): Promise<SubcategoryBreakdownResult> {
    if (!categoryId?.trim()) throw new ValidationError('O ID da categoria é obrigatório');
    return this.transactions.getSubcategoryBreakdown(categoryId, startDate, endDate, parseFilters(rawFilters));
  }
}