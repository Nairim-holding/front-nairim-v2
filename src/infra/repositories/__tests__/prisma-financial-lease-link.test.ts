import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ leases: vi.fn(), category: vi.fn(), subcategory: vi.fn(), find: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/infra/database/tenant-context', () => ({ getCurrentCompanyId: () => 'company' }));
vi.mock('@/infra/database/prisma', () => ({ default: {
  lease: { findMany: mocks.leases }, category: { findFirst: mocks.category },
  subcategory: { findFirst: mocks.subcategory },
  transaction: { findUnique: mocks.find, findFirst: mocks.find, findMany: mocks.findMany, create: mocks.create, update: mocks.update },
} }));
import { PrismaFinancialTransactionsRepository } from '../prisma-financial-transactions-repository';

const lease = { id: 'lease', contract_number: '4169/23', start_date: new Date('2023-01-01'), end_date: new Date('2024-12-31'), canceled_at: null, property: { title: 'Minas Gerais 101' } };
const data = { event_date: '2024-09-01', effective_date: '2024-09-10', description: 'Recebimento aluguel - Contrato 4169/23', amount: 1000, status: 'COMPLETED' as const, category_id: 'income', financial_institution_id: 'bank' };
describe('vínculo de locação ao operar somente no Financeiro', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.leases.mockResolvedValue([lease]); mocks.category.mockResolvedValue({ type: 'INCOME' });
    mocks.findMany.mockResolvedValue([]); mocks.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data }));
  });
  it('vincula receita inequívoca ao contrato sem intervenção em Locações', async () => {
    const result = await new PrismaFinancialTransactionsRepository().create(data);
    expect(result.lease_id).toBe('lease');
    expect(mocks.leases).toHaveBeenCalledWith(expect.objectContaining({ where: { company_id: 'company', deleted_at: null } }));
  });
  it('recusa novo recebimento manual na competência já gerada antes de gravar', async () => {
    mocks.findMany.mockResolvedValue([{ description: 'Aluguel do imóvel 1/12', category: { type: 'INCOME' } }]);
    await expect(new PrismaFinancialTransactionsRepository().create(data)).rejects.toThrow('Já existe uma parcela');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('identifica aluguel pela subcategoria quando a descrição só informa o contrato', async () => {
    mocks.subcategory.mockResolvedValue({ name: 'Aluguéis' });
    mocks.findMany.mockResolvedValue([{ description: 'Aluguel 1/12', category: { type: 'INCOME' } }]);
    await expect(new PrismaFinancialTransactionsRepository().create({ ...data, description: 'Recebimento setembro - Contrato 4169/23', subcategory_id: 'rent' })).rejects.toThrow('Já existe uma parcela');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('não confunde despesa de aluguel com a receita gerada do contrato', async () => {
    mocks.category.mockResolvedValue({ type: 'EXPENSE' });
    const result = await new PrismaFinancialTransactionsRepository().create({ ...data, description: 'Pagamento aluguel - Contrato 4169/23' });
    expect(result.lease_id).toBe('lease'); expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it('mantém vínculo ao quitar parcela gerada e rejeita troca de contrato pela descrição', async () => {
    const existing = { id: 'tx', company_id: 'company', lease_id: 'lease', installment_number: 1, description: data.description, event_date: new Date(data.event_date), effective_date: new Date(data.effective_date), status: 'PENDING' };
    mocks.find.mockResolvedValue(existing); mocks.update.mockImplementation(async ({ data }) => ({ ...existing, ...data }));
    expect((await new PrismaFinancialTransactionsRepository().update('tx', { status: 'COMPLETED' })).lease_id).toBe('lease');
    await expect(new PrismaFinancialTransactionsRepository().update('tx', { description: 'Aluguel Contrato 5000/24' })).rejects.toThrow('deve manter o contrato');
  });
  it('não restaura parcela cancelada pela locação', async () => {
    mocks.find.mockResolvedValue({ id: 'tx', canceled_at: new Date('2024-09-20') });
    await expect(new PrismaFinancialTransactionsRepository().restore('tx')).rejects.toThrow('cancelado junto com a locação');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('não restaura parcela substituída pela sincronização quando há outra ativa da competência', async () => {
    mocks.find.mockResolvedValue({ id: 'old', company_id: 'company', lease_id: 'lease', installment_number: 1,
      description: 'Aluguel - Contrato 4169/23', event_date: new Date('2024-09-01'), effective_date: new Date('2024-09-10'),
      status: 'PENDING', category_id: 'income', deleted_at: new Date(), canceled_at: null });
    mocks.findMany.mockResolvedValue([{ description: 'Aluguel 1/12', category: { type: 'INCOME' } }]);
    await expect(new PrismaFinancialTransactionsRepository().restore('old')).rejects.toThrow('Já existe uma parcela');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('recusa pendência posterior ao cancelamento, mas permite recebimento tardio de dívida antiga', async () => {
    mocks.leases.mockResolvedValue([{ ...lease, canceled_at: new Date('2024-09-05') }]);
    await expect(new PrismaFinancialTransactionsRepository().create({ ...data, status: 'PENDING' })).rejects.toThrow('a partir do cancelamento');
    expect((await new PrismaFinancialTransactionsRepository().create(data)).lease_id).toBe('lease');
  });
});
