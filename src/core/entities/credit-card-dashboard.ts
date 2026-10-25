export interface DashboardCard {
  id: string; name: string; limit: number | null; closingDay: number | null; dueDay: number | null; active: boolean;
}
export interface DashboardCardTransaction {
  id: string; cardId: string; cardName: string; date: string; effectiveDate: string; description: string;
  amount: number; status: 'PENDING' | 'COMPLETED'; year: number; month: number;
  categoryId: string; categoryName: string; subcategory: string | null;
  installment: string | null;
}
export interface CreditCardDashboard {
  year: number; month: number; selectedCardIds: string[];
  cards: Array<DashboardCard & { spent: number; pending: number; available: number | null; usage: number | null }>;
  monthly: Array<{ month: number; amount: number }>;
  categories: Array<{ id: string; name: string; amount: number }>;
  transactions: DashboardCardTransaction[];
  total: number;
}
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);

/** Fatura vinculada define a competência; na ausência dela usa-se a data efetiva. */
export function buildCreditCardDashboard(cards: DashboardCard[], entries: DashboardCardTransaction[], year: number, month: number, selectedIds?: string[]): CreditCardDashboard {
  const selectedCardIds = selectedIds ?? cards.filter(card => card.active).map(card => card.id);
  const selected = new Set(selectedCardIds);
  const owned = new Set(cards.map(card => card.id));
  const valid = entries.filter(entry => owned.has(entry.cardId) && entry.year === year);
  const period = valid.filter(entry => entry.month === month);
  const sum = (rows: DashboardCardTransaction[]) => rows.reduce((total, row) => total + cents(row.amount), 0) / 100;
  const transactions = period.filter(entry => selected.has(entry.cardId)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const categories = new Map<string, { id: string; name: string; amount: number }>();
  for (const entry of transactions) {
    const previous = categories.get(entry.categoryId);
    categories.set(entry.categoryId, { id: entry.categoryId, name: entry.categoryName, amount: (cents(previous?.amount ?? 0) + cents(entry.amount)) / 100 });
  }
  return {
    year, month, selectedCardIds,
    cards: cards.map(card => {
      const rows = period.filter(entry => entry.cardId === card.id);
      const spent = sum(rows);
      const pending = sum(rows.filter(entry => entry.status === 'PENDING'));
      return { ...card, spent, pending, available: card.limit === null ? null : (cents(card.limit) - cents(pending)) / 100,
        usage: card.limit !== null && card.limit > 0 ? Math.round(pending / card.limit * 10000) / 100 : null };
    }),
    monthly: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, amount: sum(valid.filter(entry => selected.has(entry.cardId) && entry.month === index + 1)) })),
    categories: [...categories.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
    transactions, total: sum(transactions),
  };
}
