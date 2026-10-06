import type { PlanningCategoryDashboard, PlanningDashboardItem } from '@/core/entities/planning';
import { reportingIdentity } from '@/shared/utils/reporting-identity';

function combine<T extends PlanningDashboardItem>(a: T, b: T): T {
  const planned = a.planned_amount + b.planned_amount;
  const realized = a.realized_amount + b.realized_amount;
  const monthly = new Map(a.monthly_data.map(m => [`${m.year}-${m.month}`, { ...m }]));
  for (const m of b.monthly_data) {
    const key = `${m.year}-${m.month}`;
    const existing = monthly.get(key);
    if (existing) existing.realized_amount += m.realized_amount;
    else monthly.set(key, { ...m });
  }
  const values = new Map(a.monthly_values.map(m => [m.month, { ...m }]));
  for (const m of b.monthly_values) {
    const existing = values.get(m.month);
    if (existing) existing.amount += m.amount;
    else values.set(m.month, { ...m });
  }
  const nonZero = [...monthly.values()].filter(m => m.realized_amount > 0).map(m => m.realized_amount);
  return { ...a, planned_amount: planned, realized_amount: realized,
    percentage: planned > 0 ? Math.round(realized / planned * 10000) / 100 : 0,
    med: nonZero.length ? Math.round(nonZero.reduce((sum, value) => sum + value, 0) / nonZero.length * 100) / 100 : 0,
    min: nonZero.length ? Math.min(...nonZero) : null, max: nonZero.length ? Math.max(...nonZero) : null,
    min_recommended: a.min_recommended === null && b.min_recommended === null ? null : (a.min_recommended ?? 0) + (b.min_recommended ?? 0),
    max_recommended: a.max_recommended === null && b.max_recommended === null ? null : (a.max_recommended ?? 0) + (b.max_recommended ?? 0),
    monthly_data: [...monthly.values()], monthly_values: [...values.values()] };
}

export function consolidatePlanning(categories: PlanningCategoryDashboard[]): PlanningCategoryDashboard[] {
  const byKey = new Map<string, PlanningCategoryDashboard>();
  for (const category of categories) {
    const key = reportingIdentity(category.type, category.name);
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, { ...category, subcategories: [...category.subcategories] }); continue; }
    const subs = new Map(existing.subcategories.map(s => [reportingIdentity(s.name), s]));
    for (const sub of category.subcategories) {
      const subKey = reportingIdentity(sub.name);
      const previous = subs.get(subKey);
      subs.set(subKey, previous ? combine(previous, sub) : sub);
    }
    byKey.set(key, { ...combine(existing, category), subcategories: [...subs.values()] });
  }
  return [...byKey.values()];
}
