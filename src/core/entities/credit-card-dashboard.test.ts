import { describe, expect, it } from 'vitest';
import { buildCreditCardDashboard, type DashboardCard, type DashboardCardTransaction } from './credit-card-dashboard';

const cards: DashboardCard[] = [
  { id: 'a', name: 'Ativo', limit: 100, closingDay: 1, dueDay: 10, active: true },
  { id: 'b', name: 'Inativo', limit: null, closingDay: null, dueDay: null, active: false },
];
const entry = (id: string, amount: number, extra: Partial<DashboardCardTransaction> = {}): DashboardCardTransaction => ({
  id, amount, cardId: 'a', cardName: 'Ativo', date: '2026-01-01', effectiveDate: '2026-01-10',
  description: id, status: 'PENDING', year: 2026, month: 1, categoryId: 'c', categoryName: 'Mercado', subcategory: null, installment: null, ...extra,
});
describe('painel de cartões', () => {
  it('soma em centavos, mantém pagos na fatura e desconta só pendentes do limite', () => {
    const result = buildCreditCardDashboard(cards, [entry('1', .1), entry('2', .2), entry('3', 20, { status: 'COMPLETED' })], 2026, 1);
    expect(result.total).toBe(20.3);
    expect(result.categories[0].amount).toBe(20.3);
    expect(result.monthly[0].amount).toBe(20.3);
    expect(result.cards[0]).toMatchObject({ spent: 20.3, pending: .3, available: 99.7, usage: .3 });
    expect(result.cards[1]).toMatchObject({ available: null, usage: null });
  });
  it('respeita empresa, ano, mês e seleção vazia sem voltar a selecionar todos', () => {
    const entries = [entry('1', 10), entry('2', 20, { month: 2 }), entry('3', 30, { year: 2025 }), entry('4', 40, { cardId: 'foreign' }), entry('5', 50, { cardId: 'b' })];
    const result = buildCreditCardDashboard(cards, entries, 2026, 1);
    expect(result.selectedCardIds).toEqual(['a']);
    expect(result.total).toBe(10);
    expect(result.monthly.slice(0, 2).map(row => row.amount)).toEqual([10, 20]);
    expect(buildCreditCardDashboard(cards, entries, 2026, 1, ['a', 'b']).total).toBe(60);
    expect(buildCreditCardDashboard(cards, entries, 2026, 1, []).total).toBe(0);
    expect(buildCreditCardDashboard(cards, entries, 2026, 1, []).transactions).toEqual([]);
  });
  it('mostra estouro de limite e ordena compras por data e identidade', () => {
    const result = buildCreditCardDashboard(cards, [entry('b', 80), entry('a', 30)], 2026, 1);
    expect(result.cards[0]).toMatchObject({ available: -10, usage: 110 });
    expect(result.transactions.map(row => row.id)).toEqual(['a', 'b']);
  });
});
