import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ leaseFind: vi.fn(), leaseCreate: vi.fn(), leaseUpdate: vi.fn(), transactionFind: vi.fn(), transactionCreate: vi.fn(), transactionUpdate: vi.fn() }));
vi.mock('@/infra/database/tenant-context', () => ({ getCurrentCompanyId: () => 'company' }));
vi.mock('../property-occupancy', () => ({ occupancyDate: () => new Date('2026-01-01T00:00:00Z'), syncPropertyOccupancy: vi.fn() }));
vi.mock('@/infra/database/prisma', () => {
  const client = {
    lease: { findUnique: mocks.leaseFind, create: mocks.leaseCreate, update: mocks.leaseUpdate },
    transaction: { findMany: mocks.transactionFind, create: mocks.transactionCreate, updateMany: mocks.transactionUpdate },
  };
  return { default: { ...client, $transaction: async (callback: (tx: typeof client) => unknown) => callback(client) } };
});
import { PrismaLeasesRepository } from '../prisma-leases-repository';
import { PrismaLeaseFinanceRepository } from '../prisma-lease-finance-repository';

const input = { property_id: 'property', type_id: 'type', owner_id: 'owner', tenant_id: 'tenant', contract_number: 'RENEWAL', start_date: '2026-01-01', end_date: '2026-03-01', rent_amount: 1000, rent_due_day: 5, property_tax: 0, payment_condition: 'INSTALLMENTS', iptu_installments_count: 0, iptu_installments: [] };
const lease = () => ({ ...input, id: 'lease', company_id: 'company', status: 'ACTIVE', deleted_at: null, start_date: new Date(input.start_date), end_date: new Date(input.end_date), commission_amount: 100, financial_institution_id: 'bank', agency_id: null, agency: null, property: { category_id: 'category', subcategory_id: null }, tenant: { name: 'Inquilino' } });

describe('locação sem IPTU', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.leaseFind.mockResolvedValue(lease());
    mocks.leaseCreate.mockImplementation(async ({ data }) => ({ id: 'lease', ...data }));
    mocks.leaseUpdate.mockImplementation(async ({ data }) => ({ ...lease(), ...data }));
    mocks.transactionFind.mockResolvedValue([]);
  });

  it('preserva zero parcelas ao cadastrar e reabrir uma locação', async () => {
    const saved = await new PrismaLeasesRepository().create(input);
    expect(saved.iptu_installments_count).toBe(0);
    expect(saved.property_tax).toBe(0);
    expect(mocks.leaseCreate.mock.calls[0][0].data.iptu_installments_count).toBe(0);
  });

  it('preserva zero parcelas na atualização de um contrato para renovação', async () => {
    mocks.leaseFind.mockResolvedValue({ ...lease(), property_tax: 1200, iptu_installments_count: 12 });
    const saved = await new PrismaLeasesRepository().update('lease', { property_tax: 0, iptu_installments_count: 0, iptu_installments: [] });
    expect(saved.iptu_installments_count).toBe(0);
    expect(saved.property_tax).toBe(0);
  });

  it('gera aluguel e comissão sem criar restituição de IPTU', async () => {
    await new PrismaLeaseFinanceRepository().syncLeaseTransactions('lease', 'company');
    const descriptions = mocks.transactionCreate.mock.calls.map(([args]) => args.data.description as string);
    expect(descriptions.filter((text) => text.startsWith('Aluguel'))).toHaveLength(2);
    expect(descriptions.filter((text) => text.startsWith('Comissão'))).toHaveLength(2);
    expect(descriptions.some((text) => text.startsWith('Restituição'))).toBe(false);
  });

  it('zero parcelas ignora detalhamento antigo e preserva IPTU já concluído', async () => {
    mocks.leaseFind.mockResolvedValue({ ...lease(), iptu_installments: [100, 100] });
    mocks.transactionFind.mockResolvedValue([
      { id: 'paid-iptu', status: 'COMPLETED', description: 'Restituição IPTU 1/2', installment_number: 1 },
      { id: 'pending-iptu', status: 'PENDING', description: 'Restituição IPTU 2/2', installment_number: 2 },
    ]);
    await new PrismaLeaseFinanceRepository().syncLeaseTransactions('lease', 'company');
    expect(mocks.transactionUpdate.mock.calls[0][0].where.id.in).toEqual(['pending-iptu']);
    expect(mocks.transactionCreate.mock.calls.some(([args]) => args.data.description.startsWith('Restituição'))).toBe(false);
  });

  it('mantém a geração normal de IPTU quando há valor e parcelas', async () => {
    mocks.leaseFind.mockResolvedValue({ ...lease(), property_tax: 200, iptu_installments_count: 2, iptu_installments: [100, 100] });
    await new PrismaLeaseFinanceRepository().syncLeaseTransactions('lease', 'company');
    expect(mocks.transactionCreate.mock.calls.filter(([args]) => args.data.description.startsWith('Restituição'))).toHaveLength(2);
  });
});
