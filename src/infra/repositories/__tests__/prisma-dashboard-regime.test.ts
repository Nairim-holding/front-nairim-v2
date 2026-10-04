/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportRegime } from '@/core/entities/financial-report';
import { financialDateField } from '@/core/entities/financial-report';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn(), categories: vi.fn(), category: vi.fn(), subcategories: vi.fn(), plannings: vi.fn(),
}));
vi.mock('@/infra/database/prisma', () => ({ default: {
  transaction: { findMany: mocks.findMany, aggregate: mocks.aggregate, groupBy: mocks.groupBy },
  category: { findMany: mocks.categories, findFirst: mocks.category }, subcategory: { findMany: mocks.subcategories },
  planning: { findMany: mocks.plannings },
} }));

import { PrismaFinancialTransactionsRepository } from '../prisma-financial-transactions-repository';
import { PrismaFinancialReportsRepository } from '../prisma-financial-reports-repository';
import { PrismaPlanningsRepository } from '../prisma-plannings-repository';
import { GetMonthlySummaryMultiUseCase } from '@/core/use-cases/financial-transaction/reports';
import { monthlySummaryMultiQuerySchema, financialChartDetailQuerySchema } from '@/shared/validators/financial-reports';

type Row = {
  id: string; event_date: Date; effective_date: Date; amount: number; category_id: string;
  category: { id: string; name: string; type: string }; subcategory_id: string | null;
  deleted_at: Date | null; is_transfer: boolean; status: string; description: string;
};
const transaction = (id: string, event: string, effective: string, amount: number, type = 'EXPENSE'): Row => ({
  id, event_date: new Date(event), effective_date: new Date(effective), amount,
  category_id: type, category: { id: type, name: type, type }, subcategory_id: null,
  deleted_at: null, is_transfer: false, status: 'COMPLETED', description: 'Parcela',
});

// Simula a seleção do banco, inclusive AND/OR: devolver todas as linhas esconderia
// justamente o erro de datas que esta regressão precisa detectar.
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every(part => matches(row, part));
    if (key === 'OR') return value.some((part: Record<string, any>) => matches(row, part));
    if (key === 'NOT') return !matches(row, value);
    const actual = row[key];
    if (value === null || typeof value !== 'object') return actual === value;
    if ('in' in value) return value.in.includes(actual);
    if ('contains' in value) return String(actual).toLowerCase().includes(value.contains.toLowerCase());
    if ('gte' in value || 'lte' in value || 'lt' in value) {
      return (!value.gte || actual >= value.gte) && (!value.lte || actual <= value.lte) && (!value.lt || actual < value.lt);
    }
    return matches(actual ?? {}, value);
  });
}

function database(rows: Row[]) {
  mocks.findMany.mockImplementation(async ({ where }) => rows.filter(row => matches(row, where)));
  mocks.aggregate.mockImplementation(async ({ where }) => ({ _sum: { amount: rows.filter(row => matches(row, where)).reduce((sum, row) => sum + row.amount, 0) } }));
  mocks.groupBy.mockImplementation(async ({ where, by }) => {
    const groups = new Map<string, any>();
    for (const row of rows.filter(row => matches(row, where))) {
      const key = JSON.stringify(by.map((field: keyof Row) => row[field]));
      const group = groups.get(key) ?? { ...Object.fromEntries(by.map((field: keyof Row) => [field, row[field]])), _sum: { amount: 0 } };
      group._sum.amount += row.amount; groups.set(key, group);
    }
    return [...groups.values()];
  });
  const categories = [...new Map(rows.map(row => [row.category_id, row.category])).values()];
  mocks.categories.mockResolvedValue(categories);
  mocks.category.mockImplementation(async ({ where }) => categories.find(category => category.id === where.id));
  mocks.subcategories.mockResolvedValue([]);
}

const repo = new PrismaFinancialTransactionsRepository();
const reports = new PrismaFinancialReportsRepository();
const regimes: ReportRegime[] = ['caixa', 'competencia'];

async function reconcile(rows: Row[], years: number[], regime: ReportRegime) {
  const summaries = await new GetMonthlySummaryMultiUseCase(repo).execute(years, { regime });
  const field = financialDateField(regime);
  for (const summary of summaries) {
    for (const month of summary.months) {
      const prefix = `${summary.year}-${String(month.month).padStart(2, '0')}`;
      const startDate = `${prefix}-01`;
      const last = new Date(Date.UTC(summary.year, month.month, 0)).getUTCDate();
      const endDate = `${prefix}-${last}`;
      const report = await reports.getIncomeExpense({ startDate, endDate, regime });
      expect(month.income).toBeCloseTo(report.receitas.total, 8);
      expect(month.expense).toBeCloseTo(report.despesas.total, 8);
      for (const type of ['INCOME', 'EXPENSE'] as const) {
        const details = await repo.getChartDetails({ source: 'transactions', startDate, endDate, type, regime });
        const expected = rows.filter(row => !row.deleted_at && !row.is_transfer && row.category.type === type && row[field].toISOString().startsWith(prefix));
        expect(details.map(row => row.id).sort()).toEqual(expected.map(row => row.id).sort());
        expect(details.every(row => (regime === 'caixa' ? row.effectiveDate : row.eventDate).startsWith(prefix))).toBe(true);
        expect(details.reduce((sum, row) => sum + row.value, 0)).toBeCloseTo(type === 'INCOME' ? month.income : month.expense, 8);
      }
    }
  }
  return summaries;
}

describe('regime do Dashboard e conciliação com Receitas x Despesas', () => {
  let rows: Row[];
  beforeEach(() => {
    vi.resetAllMocks();
    rows = [
      transaction('future-installment', '2026-01-01', '2027-11-01', 4700),
      transaction('previous-year', '2025-12-01', '2026-01-10', 300),
      transaction('february', '2026-01-02', '2026-02-02', 120),
      transaction('pending', '2026-02-02', '2026-02-03', 80),
      transaction('income', '2025-12-01', '2026-01-01', 1000, 'INCOME'),
      { ...transaction('deleted', '2026-01-01', '2026-01-01', 9999), deleted_at: new Date() },
      { ...transaction('transfer', '2026-01-01', '2026-01-01', 9999), is_transfer: true },
    ];
    rows[3].status = 'PENDING'; database(rows);
  });

  it('abre em Caixa e separa parcelas pela data efetiva, inclusive na mudança de ano', async () => {
    const summary = await repo.getMonthlySummary(2026);
    expect(summary.months[0]).toEqual({ month: 1, income: 1000, expense: 300 });
    expect(summary.months[1].expense).toBe(200);
    const details = await repo.getChartDetails({ source: 'transactions', type: 'EXPENSE', startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(details.map(row => row.id)).toEqual(['previous-year']);
  });

  for (const regime of regimes) it(`concilia todos os meses e detalhes de vários anos em ${regime}`, async () => {
    await reconcile(rows, [2025, 2026, 2027], regime);
  });

  it('mantém a escolha de regime nos filtros de categoria e subcategoria', async () => {
    for (const regime of regimes) {
      const start = new Date('2026-01-01'), end = new Date('2026-01-31');
      const category = await repo.getExpenseByCategory(start, end, { regime });
      const breakdown = await repo.getSubcategoryBreakdown('EXPENSE', start, end, { regime });
      const expected = regime === 'caixa' ? 300 : 4820;
      expect(category.categories[0].value).toBe(expected);
      expect(breakdown.total).toBe(expected);
    }
  });

  it('sugere os anos de competência e de Caixa e ignora anos não selecionados', async () => {
    expect((await repo.getAvailableYears()).years).toEqual([2027, 2026, 2025]);
    const result = await repo.getMonthlySummaryMulti([2027, 2025]);
    expect(result.map(item => item.year)).toEqual([2025, 2027]);
    expect(result[1].months[10].expense).toBe(4700);
    expect(result[0].months[11].expense).toBe(0);
  });

  it('aplica o regime também aos resumos realizados e aos seus detalhes', async () => {
    database(rows.filter(row => !row.is_transfer));
    mocks.categories.mockResolvedValue([{ id: 'EXPENSE', name: 'Despesas', type: 'EXPENSE', subcategories: [] }]);
    mocks.plannings.mockResolvedValue([]);
    const planning = new PrismaPlanningsRepository();
    for (const regime of regimes) {
      const result = await planning.getDashboard('2026-01-01', '2026-01-31', { regime });
      const details = await repo.getChartDetails({ source: 'planning', type: 'EXPENSE', startDate: '2026-01-01', endDate: '2026-01-31', regime });
      expect(result.expenses[0].realized_amount).toBe(regime === 'caixa' ? 300 : 4820);
      expect(details.reduce((sum, row) => sum + row.value, 0)).toBe(result.expenses[0].realized_amount);
    }
  });

  it('rejeita regime inválido e preserva Competência na consulta de detalhes', async () => {
    expect(monthlySummaryMultiQuerySchema.safeParse({ regime: 'outro' }).success).toBe(false);
    const query = financialChartDetailQuerySchema.parse({ source: 'transactions', startDate: '2026-01-01', endDate: '2026-01-31', regime: 'competencia' });
    expect(query.regime).toBe('competencia');
    await expect(new GetMonthlySummaryMultiUseCase(repo).execute([2026], { regime: 'outro' })).rejects.toThrow('regime');
  });

  // Validação opcional do backup fornecido, sem copiá-lo para o projeto ou tocar no banco real.
  it.skipIf(!process.env.NAIRIM_VALIDATION_BACKUP)('concilia todo o histórico do backup fornecido', async () => {
    const backup = JSON.parse(readFileSync(process.env.NAIRIM_VALIDATION_BACKUP!, 'utf8').replace(/^\uFEFF/, '')).data;
    const categories = new Map<string, any>(backup.categories.map((category: any) => [category.id, category]));
    const backupRows: Row[] = backup.transactions.map((row: any) => ({
      ...row, amount: Number(row.amount), category: categories.get(row.category_id),
      event_date: new Date(row.event_date), effective_date: new Date(row.effective_date),
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    }));
    database(backupRows);
    const years = [...new Set(backupRows.flatMap(row => [row.event_date.getUTCFullYear(), row.effective_date.getUTCFullYear()]))];
    for (const regime of regimes) {
      const result = await reconcile(backupRows, years, regime);
      const months = result.find(item => item.year === 2026)!.months;
      expect(months[0].income).toBeCloseTo(34305.35, 2);
      expect(months[0].expense).toBeCloseTo(regime === 'caixa' ? 23626.41 : 94343.74, 2);
      expect(months[1].expense).toBeCloseTo(regime === 'caixa' ? 34635.87 : 115160.06, 2);
    }
  });
});
