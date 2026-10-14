import { describe, expect, it } from 'vitest';
import {
  installmentLabel,
  leaseHistorySituation,
  leaseHistorySituationLabel,
  summarizeLeaseHistory,
  type LeaseHistoryRow,
} from '@/core/entities/lease-financial-history';

const today = new Date('2026-10-13T00:00:00.000Z');
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('histórico financeiro da locação', () => {
  it('classifica a situação do lançamento', () => {
    expect(leaseHistorySituation({ status: 'COMPLETED', effective_date: date('2024-09-10'), canceled_at: null }, today)).toBe('SETTLED');
    expect(leaseHistorySituation({ status: 'PENDING', effective_date: date('2024-09-10'), canceled_at: null }, today)).toBe('OVERDUE');
    expect(leaseHistorySituation({ status: 'PENDING', effective_date: date('2026-11-10'), canceled_at: null }, today)).toBe('PENDING');
  });

  it('o dia do vencimento ainda não é atraso', () => {
    expect(leaseHistorySituation({ status: 'PENDING', effective_date: date('2026-10-13'), canceled_at: null }, today)).toBe('PENDING');
  });

  it('o cancelamento prevalece sobre o vencimento', () => {
    expect(leaseHistorySituation({ status: 'PENDING', effective_date: date('2024-09-10'), canceled_at: date('2024-08-01') }, today)).toBe('CANCELED');
  });

  it('rotula receita quitada como Recebido e despesa como Pago', () => {
    expect(leaseHistorySituationLabel('SETTLED', 'INCOME')).toBe('Recebido');
    expect(leaseHistorySituationLabel('SETTLED', 'EXPENSE')).toBe('Pago');
    expect(leaseHistorySituationLabel('CANCELED', 'INCOME')).toBe('Cancelado');
    expect(leaseHistorySituationLabel('OVERDUE', 'INCOME')).toBe('Em atraso');
  });

  it('mostra a parcela só quando o lançamento é do schedule', () => {
    expect(installmentLabel(10, 11)).toBe('10/11');
    expect(installmentLabel(null, null)).toBe('—');
  });

  it('totaliza só as receitas, por situação', () => {
    const row = (overrides: Partial<LeaseHistoryRow>): LeaseHistoryRow => ({
      id: 'x', installment: '1/2', description: 'Aluguel', type: 'INCOME', eventDate: '2024-09-10', dueDate: '2024-09-10',
      amount: 1100, status: 'PENDING', situation: 'OVERDUE', situationLabel: 'Em atraso', canceled: false, ...overrides,
    });
    const totals = summarizeLeaseHistory([
      row({}),
      row({ id: 'y' }),
      row({ id: 'z', situation: 'CANCELED', canceled: true, amount: 1100.1 }),
      row({ id: 'c', type: 'EXPENSE', situation: 'SETTLED', amount: 110 }),
    ]);
    expect(totals.OVERDUE).toEqual({ count: 2, amount: 2200 });
    expect(totals.CANCELED).toEqual({ count: 1, amount: 1100.1 });
    expect(totals.SETTLED).toEqual({ count: 0, amount: 0 });
  });
});
