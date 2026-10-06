import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  investment: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
  investmentTransaction: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  investmentMonthBalance: { findMany: vi.fn() }, planning: { findMany: vi.fn() }, investmentSettings: { findUnique: vi.fn() },
}));
vi.mock('@/infra/database/prisma', () => ({ default: { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) } }));
vi.mock('@/infra/database/tenant-context', () => ({ getCurrentCompanyId: () => 'company' }));
import { PrismaInvestmentsRepository } from './prisma-investments-repository';

const record = { id: 'pgbl', company_id: 'company', financial_institution_id: 'bank', financial_institution: { name: 'Banco' }, partition: 'Principal', issuer: 'Banco',
  product_type: 'PREVIDENCIA', product: 'PGBL – Classico IV FIC Renda Fixa', application_date: new Date('2024-01-01'),
  maturity_date: null, liquidity_days: 0, liquidity_at_maturity: false, invested_amount: 1137238.76, notes: null, display_order: 1, liquidated_at: null, is_active: true };
const repo = new PrismaInvestmentsRepository();
beforeEach(() => {
  vi.resetAllMocks();
  db.investmentTransaction.findMany.mockResolvedValue([]);
  db.investmentMonthBalance.findMany.mockResolvedValue([]);
  db.planning.findMany.mockResolvedValue([]);
  db.investmentSettings.findUnique.mockResolvedValue(null);
  db.investment.findFirst.mockResolvedValue(record);
  db.investment.update.mockResolvedValue(record);
});

describe('investimentos no repositório', () => {
  it.each([false, true])('retorna R$ 18.998,32 em janeiro com aportes iniciais presentes=%s', async initialTransactions => {
    const vgbl = { ...record, id: 'vgbl', product: 'VGBL', invested_amount: 707318.13 };
    db.investment.findMany.mockResolvedValue([record, vgbl]);
    if (initialTransactions) db.investmentTransaction.findMany.mockResolvedValue([record, vgbl].map(row => ({ investment_id: row.id, type: 'CONTRIBUTION', date: row.application_date, amount: row.invested_amount })));
    db.investmentMonthBalance.findMany.mockResolvedValue([
      { investment_id: 'pgbl', year: 2025, month: 1, balance: 1148951.94 },
      { investment_id: 'vgbl', year: 2025, month: 1, balance: 714603.27 },
    ]);
    const result = await repo.getDashboard({ startMonth: '2025-01', endMonth: '2025-01' });
    expect(result.summary[0]).toMatchObject({ yield_amount: 18998.32, total_balance: 1863555.21, total_applied: 0 });
    expect(result.investments.map(row => row.months[0].balance)).toEqual([1148951.94, 714603.27]);
  });

  it('cria investimento com valor inicial zero', async () => {
    db.investment.aggregate.mockResolvedValue({ _max: { display_order: 1 } });
    db.investment.create.mockResolvedValue({ ...record, invested_amount: 0 });
    const input = { financial_institution_id: 'bank', issuer: 'Banco', product_type: 'CDB' as const, product: 'Produto', application_date: '2025-01-01', invested_amount: 0 };
    expect((await repo.create(input)).invested_amount).toBe(0);
    expect(db.investment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ invested_amount: 0, transactions: { create: { type: 'CONTRIBUTION', date: new Date('2025-01-01'), amount: 0 } } }) }));
  });

  it('sincroniza o aporte inicial com zero sem sobrescrever outras transações', async () => {
    db.investmentTransaction.findFirst.mockResolvedValue({ id: 'initial' });
    await repo.update('pgbl', { invested_amount: 0 });
    expect(db.investmentTransaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { investment_id: 'pgbl', type: 'CONTRIBUTION', date: record.application_date, amount: record.invested_amount } }));
    expect(db.investmentTransaction.update).toHaveBeenCalledWith({ where: { id: 'initial' }, data: { amount: 0 } });
  });

  it('cria o aporte inicial ausente ao editar o cadastro, preservando aportes extras', async () => {
    db.investmentTransaction.findFirst.mockResolvedValue(null);
    await repo.update('pgbl', { invested_amount: 0 });
    expect(db.investmentTransaction.create).toHaveBeenCalledWith({ data: { investment_id: 'pgbl', type: 'CONTRIBUTION', date: record.application_date, amount: 0 } });
    expect(db.investmentTransaction.update).not.toHaveBeenCalled();
  });

  it('recusa alteração de investimento ausente da empresa', async () => {
    db.investment.findFirst.mockResolvedValue(null);
    await expect(repo.update('foreign', { invested_amount: 0 })).rejects.toThrow('não encontrado');
    expect(db.investment.update).not.toHaveBeenCalled();
  });
});
