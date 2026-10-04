export interface CenterSummaryRow { id: string | null; name: string; income: number; expense: number; balance: number }
export function buildCenterSummary(
  totals: { center_id: string | null; category_id: string; amount: number }[],
  centers: { id: string; name: string }[], categories: { id: string; type: string }[],
): CenterSummaryRow[] {
  const names = new Map(centers.map(c => [c.id, c.name]));
  const types = new Map(categories.map(c => [c.id, c.type]));
  const result = new Map<string | null, CenterSummaryRow>();
  for (const total of totals) {
    const type = types.get(total.category_id);
    if (type !== 'INCOME' && type !== 'EXPENSE') continue;
    const row = result.get(total.center_id) ?? { id: total.center_id, name: total.center_id ? names.get(total.center_id) ?? 'Centro excluído' : 'Sem centro', income: 0, expense: 0, balance: 0 };
    row[type === 'INCOME' ? 'income' : 'expense'] += total.amount;
    row.balance = Math.round((row.income - row.expense) * 100) / 100;
    result.set(total.center_id, row);
  }
  return [...result.values()].sort((a,b) => b.income + b.expense - a.income - a.expense);
}
