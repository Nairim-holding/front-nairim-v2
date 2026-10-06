import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ raw: vi.fn(), categories: vi.fn(), subcategories: vi.fn(), transactions: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: { $queryRaw: db.raw, category: { findMany: db.categories }, subcategory: { findMany: db.subcategories }, transaction: { findMany: db.transactions } } }));
import { consolidatedMonthlySummary, consolidatedExpenseCategories, consolidatedAvailableYears } from './consolidated-financial-aggregates';
import { expandReportingFilters } from './reporting-catalog';
import { PrismaFinancialReportsRepository } from './prisma-financial-reports-repository';
import { runWithReportingCompanies } from '@/infra/database/reporting-context';
const params = { startDate: '2025-01-01', endDate: '2025-01-31' };
describe('consolidated reporting', () => {
  beforeEach(() => { Object.values(db).forEach(mock => mock.mockReset()); });
  it('aggregates 100 companies in one parameterized monthly query', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `company-${i}`);
    db.raw.mockResolvedValue([{ year: 2025, month: 1, type: 'INCOME', amount: '18998.32' }, { year: 2025, month: 1, type: 'EXPENSE', amount: '5000' }]);
    const result = await runWithReportingCompanies(ids, () => consolidatedMonthlySummary([2025], { regime: 'competencia', description: ["'); DROP TABLE x; --"] }));
    expect(result[0].months[0]).toEqual({ month: 1, income: 18998.32, expense: 5000 });
    expect(result[0].months).toHaveLength(12); expect(db.raw).toHaveBeenCalledTimes(1);
    const sql = db.raw.mock.calls[0][0];
    expect(sql.text).toContain('t."event_date"'); expect(sql.text).toContain('GROUP BY');
    expect(sql.text).not.toContain('DROP TABLE'); expect(sql.values).toEqual(expect.arrayContaining(ids));
    expect(sql.text).toContain('t.deleted_at IS NULL'); expect(sql.text).toContain('t.is_transfer = false');
  });
  it('merges category totals and yearly values by equivalent names and type', async () => {
    db.raw.mockResolvedValue([
      { id: 'a', name: 'Despesas Fixas', type: 'EXPENSE', year: 2024, amount: '100' },
      { id: 'b', name: ' despesas  fixas ', type: 'EXPENSE', year: 2025, amount: '250.50' },
      { id: 'c', name: 'Despesas Fixas', type: 'INCOME', year: 2025, amount: '900' },
    ]);
    const result = await runWithReportingCompanies(['a', 'b'], () => consolidatedExpenseCategories(new Date('2024-01-01'), new Date('2025-12-31'), {}));
    expect(result.totalIncome).toBe(900); expect(result.categories).toHaveLength(1);
    expect(result.categories[0]).toMatchObject({ value: 350.5, byYear: [{ year: 2024, value: 100 }, { year: 2025, value: 250.5 }] });
  });
  it('expands categories/subcategories only along equivalent type and parent paths', async () => {
    db.categories.mockResolvedValue([
      { id: 'a', name: 'Fixas', type: 'EXPENSE' }, { id: 'b', name: ' fixas ', type: 'EXPENSE' },
      { id: 'c', name: 'Fixas', type: 'INCOME' }, { id: 'd', name: 'Variáveis', type: 'EXPENSE' },
    ]);
    db.subcategories.mockResolvedValue([
      { id: 's1', name: 'Manutenção', category_id: 'a' }, { id: 's2', name: 'manutenção', category_id: 'b' },
      { id: 's3', name: 'Manutenção', category_id: 'c' }, { id: 's4', name: 'Manutenção', category_id: 'd' },
    ]);
    const result = await runWithReportingCompanies(['a', 'b'], () => expandReportingFilters({ category_id: ['a'], 'filter[subcategory_id]': 's1' }));
    expect(result.category_id).toEqual(['a', 'b']); expect(result['filter[subcategory_id]']).toEqual(['s1', 's2']);
    expect(db.categories).toHaveBeenCalledTimes(1); expect(db.subcategories).toHaveBeenCalledTimes(1);
  });
  it('consolidates report rows but keeps the same subcategory under different parents distinct', async () => {
    const tx = (id: string, parent: string, name: string, type = 'EXPENSE') => ({ id, description: id, amount: 100, status: 'COMPLETED', event_date: new Date('2025-01-01'), effective_date: new Date('2025-01-01'), category: { id: parent, name, type }, subcategory: { id: `s-${id}`, name: 'Manutenção' } });
    db.transactions.mockResolvedValue([tx('1', 'a', 'Fixas'), tx('2', 'b', ' FIXAS '), tx('3', 'c', 'Variáveis'), tx('4', 'd', 'Fixas', 'INCOME')]);
    const result = await runWithReportingCompanies(['a', 'b'], () => new PrismaFinancialReportsRepository().getGrouped(params, 'subcategory'));
    expect(result.groups).toHaveLength(3); expect(result.groups.map(g => g.total).sort()).toEqual([100, 100, 200]); expect(result.totalGeral).toBe(400);
    const single = await new PrismaFinancialReportsRepository().getGrouped(params, 'subcategory');
    expect(single.groups).toHaveLength(4);
  });
  it('loads available years without downloading transaction history', async () => {
    db.raw.mockResolvedValue([{ year: 2025 }, { year: 2024 }]);
    expect(await runWithReportingCompanies(['a', 'b'], () => consolidatedAvailableYears())).toEqual({ years: [2025, 2024] });
    expect(db.raw).toHaveBeenCalledTimes(1); expect(db.transactions).not.toHaveBeenCalled();
  });
});
