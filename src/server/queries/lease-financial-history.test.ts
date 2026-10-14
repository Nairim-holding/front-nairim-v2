import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  leaseFindFirst: vi.fn(),
  leaseFindMany: vi.fn(),
  transactionFindMany: vi.fn(),
  transactionUpdateMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/infra/database/prisma', () => ({
  default: {
    lease: { findFirst: mocks.leaseFindFirst, findMany: mocks.leaseFindMany },
    transaction: { findMany: mocks.transactionFindMany, updateMany: mocks.transactionUpdateMany },
  },
}));
vi.mock('@/infra/auth/session', () => ({
  withPermission: vi.fn((_resource: string, _action: string, fn: () => unknown) => fn()),
}));

import { getLeaseFinancialHistoryData, linkTransactionsToLeaseData } from './lease-financial-history';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const lease = { id: 'lease-1', contract_number: '4169/23', status: 'CANCELED', property: { title: 'Rua Minas Gerais, 101' }, tenant: { name: 'Locatário' } };
const allLeases = [
  { id: 'lease-1', contract_number: '4169/23', start_date: date('2023-11-10'), end_date: date('2024-10-10'), canceled_at: null, property: { title: 'Rua Minas Gerais, 101' } },
  { id: 'lease-2', contract_number: '5000/24', start_date: date('2024-11-10'), end_date: date('2099-01-01'), canceled_at: null, property: { title: 'Rua América, 389' } },
];
const tx = (overrides: Record<string, unknown>) => ({
  id: 'tx', description: 'Aluguel do imóvel 10/11 – Locatário – Contrato 4169/23', amount: 1100, status: 'PENDING',
  event_date: date('2024-09-10'), effective_date: date('2024-09-10'), canceled_at: null,
  installment_number: 10, total_installments: 11, category: { type: 'INCOME' }, ...overrides,
});

/** A consulta de vinculados filtra por `lease_id` do contrato; a de candidatos, por `lease_id: null`. */
function stubTransactions(linked: unknown[], loose: unknown[]) {
  mocks.transactionFindMany.mockImplementation(async ({ where }: { where: { lease_id: string | null } }) => (where.lease_id === null ? loose : linked));
}

describe('histórico financeiro da locação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.leaseFindFirst.mockResolvedValue(lease);
    mocks.leaseFindMany.mockResolvedValue(allLeases);
  });

  it('traz os lançamentos ativos e os cancelados, sem os apagados na regeneração', async () => {
    stubTransactions([], []);
    await getLeaseFinancialHistoryData('lease-1');

    const linkedQuery = mocks.transactionFindMany.mock.calls.map(([args]) => args).find((args) => args.where.lease_id === 'lease-1');
    expect(linkedQuery.where.OR).toEqual([{ deleted_at: null }, { canceled_at: { not: null } }]);
  });

  it('marca a situação de cada lançamento e totaliza as receitas', async () => {
    stubTransactions([
      tx({ id: 'paid', status: 'COMPLETED', effective_date: date('2024-08-10'), installment_number: 9 }),
      tx({ id: 'late' }),
      tx({ id: 'gone', effective_date: date('2024-10-10'), canceled_at: date('2024-09-20'), installment_number: 11 }),
      tx({ id: 'fee', description: 'Comissão 10/11 - Contrato 4169/23', amount: 110, status: 'COMPLETED', category: { type: 'EXPENSE' } }),
    ], []);

    const history = await getLeaseFinancialHistoryData('lease-1');

    expect(history.rows.map((row) => [row.id, row.situationLabel, row.canceled])).toEqual([
      ['paid', 'Recebido', false],
      ['late', 'Em atraso', false],
      ['gone', 'Cancelado', true],
      ['fee', 'Pago', false],
    ]);
    expect(history.rows[1].installment).toBe('10/11');
    expect(history.totals.SETTLED).toEqual({ count: 1, amount: 1100 });
    expect(history.totals.OVERDUE).toEqual({ count: 1, amount: 1100 });
    expect(history.totals.CANCELED).toEqual({ count: 1, amount: 1100 });
    expect(history.lease.canceled).toBe(true);
  });

  it('sugere só os lançamentos sem vínculo que citam este contrato', async () => {
    stubTransactions([], [
      tx({ id: 'mine', description: 'Aluguel recebido – Contrato 4169/23' }),
      tx({ id: 'other', description: 'Aluguel recebido – Contrato 5000/24' }),
    ]);

    const history = await getLeaseFinancialHistoryData('lease-1');
    expect(history.candidates.map((candidate) => candidate.id)).toEqual(['mine']);
  });

  it('vincula apenas o que a própria consulta sugere', async () => {
    stubTransactions([], [tx({ id: 'mine', description: 'Aluguel recebido – Contrato 4169/23' })]);
    mocks.transactionUpdateMany.mockResolvedValue({ count: 1 });

    const result = await linkTransactionsToLeaseData('lease-1', ['mine', 'de-outro-contrato']);

    expect(result).toEqual({ linked: 1 });
    expect(mocks.transactionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['mine'] }, lease_id: null, deleted_at: null },
      data: { lease_id: 'lease-1' },
    });
  });

  it('não grava nada quando nenhum ID é um candidato válido', async () => {
    stubTransactions([], []);
    expect(await linkTransactionsToLeaseData('lease-1', ['qualquer'])).toEqual({ linked: 0 });
    expect(mocks.transactionUpdateMany).not.toHaveBeenCalled();
  });
});
