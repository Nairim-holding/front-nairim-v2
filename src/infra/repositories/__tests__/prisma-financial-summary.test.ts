import { beforeEach, expect, it, vi } from 'vitest';
import { PrismaFinancialTransactionsRepository } from '../prisma-financial-transactions-repository';

const transaction = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
  aggregate: vi.fn(),
}));
vi.mock('@/infra/database/prisma', () => ({ default: { transaction } }));

const repository = new PrismaFinancialTransactionsRepository();
const params = { page: 1, limit: 1, filters: {}, sortOptions: {}, includeInactive: false };

beforeEach(() => {
  vi.resetAllMocks();
  transaction.findMany.mockResolvedValue([]);
  transaction.count.mockResolvedValue(0);
  transaction.groupBy.mockResolvedValue([]);
  transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
});

it('calcula o resumo sobre todos os resultados da pesquisa e exclui transferências', async () => {
  const row = { event_date: new Date('2026-11-10'), category: { type: 'INCOME' } };
  transaction.findMany.mockResolvedValue([
    { ...row, id: '1', description: 'Aluguel Norte', status: 'PENDING', amount: '20.00' },
    { ...row, id: '2', description: 'Aluguel Norte', status: 'COMPLETED', amount: '80.50' },
    { ...row, id: '3', description: 'Transferência Norte', status: 'COMPLETED', amount: '900.00', is_transfer: true },
    { ...row, id: '4', description: 'Aluguel Sul', status: 'COMPLETED', amount: '100.00' },
  ]);

  const result = await repository.list({ ...params, search: 'Norte' });
  expect(result.data).toHaveLength(1);
  expect(result.totals).toMatchObject({ receitasPrevisto: 20, receitasRecebido: 80.5 });
});

it('mantém os filtros de tipo e status na agregação das receitas e despesas', async () => {
  await repository.list({ ...params, filters: { type: 'INCOME', status: 'COMPLETED', financial_institution_id: 'bank' } });
  expect(transaction.aggregate).toHaveBeenCalledWith({
    where: {
      category: { type: 'INCOME' },
      status: { in: ['COMPLETED'] },
      financial_institution_id: { in: ['bank'] },
      deleted_at: null,
      NOT: { is_transfer: true },
      AND: [{ category: { type: 'EXPENSE' }, status: 'PENDING' }],
    },
    _sum: { amount: true },
  });
});
