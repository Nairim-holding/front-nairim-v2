import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: { transaction: { findMany: mocks.findMany } } }));

import { PrismaFinancialTransactionsRepository } from '../prisma-financial-transactions-repository';
import { GetFinancialChartDetailsUseCase } from '@/core/use-cases/financial-transaction/reports';
import { financialChartDetailQuerySchema } from '@/shared/validators/financial-reports';

const period = { startDate: '2026-09-01', endDate: '2026-09-30' };
const dateRange = { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') };
const transaction = (id: string, type: string, amount: string) => ({
  id, event_date: new Date('2026-09-01'), effective_date: new Date('2026-09-30'),
  description: `Lançamento ${id}`, amount, status: 'COMPLETED',
  category: { name: 'Despesas Variáveis', type }, subcategory: { name: 'Manutenção' },
  financial_institution: { name: 'Conta principal' }, card: null,
  supplier: { trade_name: 'Prestador', legal_name: 'Prestador Ltda.' }, center: { name: 'Imóveis' },
});

describe('lançamentos que compõem os gráficos financeiros', () => {
  const repository = new PrismaFinancialTransactionsRepository();
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findMany.mockResolvedValue([
      transaction('expense-1', 'EXPENSE', '100.25'), transaction('expense-2', 'EXPENSE', '249.75'),
    ]);
  });

  it('traz os lançamentos e o total da categoria selecionada, mantendo os filtros globais', async () => {
    const result = await repository.getChartDetails({
      source: 'transactions', type: 'EXPENSE', categoryId: 'variable', ...period,
    }, { category_id: ['fixed', 'variable'], supplier_id: ['supplier'], description: ['reparo'] });
    expect(result.map(row => row.id)).toEqual(['expense-1', 'expense-2']);
    expect(result.reduce((sum, row) => sum + row.value, 0)).toBe(350);
    expect(result[0]).toMatchObject({ eventDate: '2026-09-01', effectiveDate: '2026-09-30', supplier: 'Prestador' });
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ deleted_at: null, NOT: { is_transfer: true }, category: { type: 'EXPENSE' } });
    expect(where).not.toHaveProperty('status');
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ category_id: { in: ['fixed', 'variable'] }, supplier_id: { in: ['supplier'] } }),
      { category_id: 'variable' }, { effective_date: dateRange },
    ]));
  });

  it('usa Caixa por padrão e o tipo de série nos gráficos mensais e anuais', async () => {
    await repository.getChartDetails({ source: 'transactions', type: 'INCOME', ...period });
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.category).toEqual({ type: 'INCOME' });
    expect(where.AND).toContainEqual({ effective_date: dateRange });
  });

  it('separa lançamentos sem subcategoria de todas as outras subcategorias', async () => {
    await repository.getChartDetails({ source: 'transactions', categoryId: 'variable', subcategoryId: null, ...period });
    expect(mocks.findMany.mock.calls[0][0].where.AND).toContainEqual({ subcategory_id: null });
  });

  it('mantém a data efetiva e somente concluídos no realizado do planejamento', async () => {
    await repository.getChartDetails({
      source: 'planning', type: 'EXPENSE', categoryId: 'variable', subcategoryId: 'repair', ...period,
    }, { description: ['Reparo'], center_id: ['properties'] });
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
    expect(where).not.toHaveProperty('NOT');
    expect(where.AND).toEqual(expect.arrayContaining([
      { effective_date: dateRange }, { category_id: 'variable' }, { subcategory_id: 'repair' },
      { description: { in: ['Reparo'] } }, { center_id: { in: ['properties'] } },
    ]));
  });

  it('considera competência ou data efetiva no consumo do cartão selecionado', async () => {
    await repository.getChartDetails({ source: 'cards', cardId: 'card-2', ...period }, { description: ['obra'] });
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.category).toEqual({ type: 'EXPENSE' });
    expect(where.AND).toContainEqual({ card_id: 'card-2' });
    expect(where.AND).toContainEqual({ OR: [{ event_date: dateRange }, { effective_date: dateRange }] });
    expect(where.AND).toContainEqual({ OR: [{ description: { contains: 'obra', mode: 'insensitive' } }] });
  });

  it('reconcilia o saldo da conta com receitas e débitos, incluindo transferências concluídas', async () => {
    mocks.findMany.mockResolvedValue([
      transaction('income', 'INCOME', '1000'), transaction('expense', 'EXPENSE', '350'),
    ]);
    const rows = await repository.getChartDetails({ source: 'balance', institutionId: 'bank' });
    expect(rows.map(row => row.value)).toEqual([1000, -350]);
    expect(rows.reduce((sum, row) => sum + row.value, 0)).toBe(650);
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
    expect(where).not.toHaveProperty('NOT');
    expect(where.AND).toContainEqual({ financial_institution_id: 'bank' });
    expect(where.AND).toContainEqual({ effective_date: { lte: expect.any(Date) } });
  });

  it('mostra a composição da receita restante com despesas negativas', async () => {
    mocks.findMany.mockResolvedValue([
      transaction('income', 'INCOME', '800'), transaction('expense', 'EXPENSE', '300'),
    ]);
    const rows = await repository.getChartDetails({ source: 'transactions', net: true, ...period });
    expect(rows.reduce((sum, row) => sum + row.value, 0)).toBe(500);
  });

  it('normaliza seleções múltiplas e rejeita períodos inválidos antes da consulta', async () => {
    const getChartDetails = vi.fn().mockResolvedValue([]);
    await new GetFinancialChartDetailsUseCase({ getChartDetails }).execute(
      { source: 'transactions', ...period }, { category_id: 'variable', supplier_id: ['a', 'b'], description: 'reparo' },
    );
    expect(getChartDetails).toHaveBeenCalledWith({ source: 'transactions', ...period }, {
      category_id: ['variable'], supplier_id: ['a', 'b'], description: ['reparo'],
    });
    for (const query of [
      { source: 'transactions' },
      { source: 'transactions', startDate: '2026-09-30', endDate: '2026-09-01' },
      { source: 'transactions', startDate: '2026-02-31', endDate: '2026-09-30' },
      { source: 'balance' },
    ]) expect(financialChartDetailQuerySchema.safeParse(query).success).toBe(false);
    expect(financialChartDetailQuerySchema.safeParse({ source: 'balance', institutionId: 'bank' }).success).toBe(true);
  });
});
