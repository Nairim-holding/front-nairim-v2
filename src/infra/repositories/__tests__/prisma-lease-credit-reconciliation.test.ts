import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ leases: vi.fn(), holidays: vi.fn(), transactions: vi.fn(), update: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: {
  lease: { findMany: mocks.leases }, holiday: { findMany: mocks.holidays },
  transaction: { findMany: mocks.transactions, updateMany: mocks.update },
} }));
import { PrismaLeaseCreditReconciliationRepository } from '../prisma-lease-credit-reconciliation-repository';

const input = { credit_date: '2026-06-22', credited_amount: 1000, financial_institution_id: 'bank', agency_ids: ['agency'] };
const lease = () => ({ id: 'lease', start_date: new Date('2025-01-01'), end_date: new Date('2026-06-01'), rent_due_day: 5, tax_due_day: 20, condo_due_day: null, rent_amount: 1000, commission_amount: 100, agency_commission: 10, agency: null, tenant: { name: 'Inquilino' }, property: { title: 'Imóvel', income_tax_withholding: false, agency: { trade_name: 'Imobiliária' }, addresses: [{ address: { city: 'Garça', state: 'SP' } }] } });
const transaction = (id: string, description: string, amount: number, date = '2026-06-20') => ({ id, lease_id: 'lease', description, amount, effective_date: new Date(`${date}T00:00:00Z`) });

describe('busca de imóveis por crédito de locação', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.leases.mockResolvedValue([lease()]);
    mocks.holidays.mockResolvedValue([]);
    mocks.transactions.mockResolvedValue([transaction('rent', 'Aluguel do imóvel', 1000), transaction('commission', 'Comissão', 100), transaction('iptu', 'Restituição IPTU', 100)]);
    mocks.update.mockResolvedValue({ count: 3 });
  });
  it('usa o vencimento real da parcela, mesmo diferente do contrato ou no último mês', async () => {
    const result = await new PrismaLeaseCreditReconciliationRepository().search('company', input);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rent_due_date: '2026-06-20', net_amount: 1000, amount_matches: true, agency_name: 'Imobiliária', pending_transaction_ids: ['rent', 'commission', 'iptu'] });
    expect(mocks.leases.mock.calls[0][0].where).not.toHaveProperty('financial_institution_id');
    expect(mocks.transactions.mock.calls[0][0].where).toMatchObject({ company_id: 'company', financial_institution_id: 'bank', status: 'PENDING', deleted_at: null });
  });
  it('encontra repasse após feriado estadual ou móvel automático', async () => {
    mocks.transactions.mockResolvedValue([transaction('rent', 'Aluguel', 1100, '2026-07-09')]);
    expect(await new PrismaLeaseCreditReconciliationRepository().search('company', { ...input, credit_date: '2026-07-10' })).toHaveLength(1);
    mocks.transactions.mockResolvedValue([transaction('rent', 'Aluguel', 1100, '2026-04-03')]);
    expect(await new PrismaLeaseCreditReconciliationRepository().search('company', { ...input, credit_date: '2026-04-06' })).toHaveLength(1);
  });
  it('não inclui lançamentos de outro vencimento nem despesas avulsas', async () => {
    mocks.transactions.mockResolvedValue([transaction('rent', 'Aluguel', 1000), transaction('old', 'Aluguel', 1000, '2026-06-19'), transaction('other', 'Manutenção', 200)]);
    const result = await new PrismaLeaseCreditReconciliationRepository().search('company', input);
    expect(result[0].pending_transaction_ids).toEqual(['rent']);
  });
  it('revalida a pesquisa antes de concluir e restringe a atualização à empresa e banco', async () => {
    const repo = new PrismaLeaseCreditReconciliationRepository();
    await repo.complete('company', { ...input, lease_id: 'lease' });
    expect(mocks.update.mock.calls[0][0].where).toMatchObject({ company_id: 'company', financial_institution_id: 'bank', status: 'PENDING', id: { in: ['rent', 'commission', 'iptu'] } });
    mocks.transactions.mockResolvedValue([]);
    expect((await repo.complete('company', { ...input, lease_id: 'lease' })).updated_transactions).toBe(0);
    expect(mocks.update).toHaveBeenCalledOnce();
  });
});
