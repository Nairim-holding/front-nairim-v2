import { expect, it } from 'vitest';
import { consolidatePlanning } from './consolidated-planning';
import type { PlanningCategoryDashboard } from '@/core/entities/planning';
it('merges planning along type/parent paths and recalculates statistics over combined months', () => {
  const item = (id: string, name: string, january: number, february: number): PlanningCategoryDashboard => ({ id, name, type: 'EXPENSE', planned_amount: 1000, realized_amount: january + february, percentage: 0,
    min: Math.min(january, february), max: Math.max(january, february), med: 0, min_recommended: null, max_recommended: null,
    monthly_data: [{ month: 1, year: 2025, realized_amount: january }, { month: 2, year: 2025, realized_amount: february }], monthly_values: [{ month: 1, amount: 1000 }], subcategories: [] });
  const a = item('a', 'Fixas', 100, 900); const b = item('b', ' FIXAS ', 900, 100);
  a.subcategories = [{ ...a, id: 's1', name: 'Manutenção' }]; b.subcategories = [{ ...b, id: 's2', name: 'manutenção' }];
  const other = item('c', 'Variáveis', 200, 300); other.subcategories = [{ ...other, id: 's3', name: 'Manutenção' }];
  const result = consolidatePlanning([a, b, other, { ...item('d', 'Fixas', 10, 20), type: 'INCOME' }]);
  expect(result).toHaveLength(3);
  expect(result[0]).toMatchObject({ planned_amount: 2000, realized_amount: 2000, percentage: 100, min: 1000, max: 1000, med: 1000, monthly_values: [{ month: 1, amount: 2000 }] });
  expect(result[0].subcategories).toHaveLength(1); expect(result[0].subcategories[0].realized_amount).toBe(2000);
  expect(a.monthly_data[0].realized_amount).toBe(100);
});
