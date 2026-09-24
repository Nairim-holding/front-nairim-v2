import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  leaseFind: vi.fn(),
  leaseUpdate: vi.fn(),
  transactionFind: vi.fn(),
  transactionUpdate: vi.fn(),
}));

vi.mock('../property-occupancy', () => ({
  occupancyDate: () => new Date('2026-09-22T00:00:00Z'),
  syncPropertyOccupancy: vi.fn(),
}));
vi.mock('@/infra/database/prisma', () => {
  const client = {
    lease: { findFirst: mocks.leaseFind, update: mocks.leaseUpdate },
    transaction: { findMany: mocks.transactionFind, updateMany: mocks.transactionUpdate },
  };
  return { default: { ...client, $transaction: async (fn: (tx: typeof client) => unknown) => fn(client) } };
});

import { PrismaLeasesRepository } from '../prisma-leases-repository';

const lease = {
  id: 'lease-4423-25', company_id: 'company', property_id: 'property',
  contract_number: '4423/25', status: 'ACTIVE', deleted_at: null,
  end_date: new Date('2026-10-08T00:00:00Z'),
  cancellation_penalty: null, other_cancellation_amounts: null,
  cancellation_justification: null,
};

describe('cancelamento de locação', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.leaseFind.mockResolvedValue(lease);
    mocks.leaseUpdate.mockImplementation(async ({ data }) => ({ ...lease, ...data }));
    mocks.transactionFind.mockResolvedValue([]);
    mocks.transactionUpdate.mockResolvedValue({ count: 2 });
  });

  it('inclui na prévia vencimentos após o fim do contrato', async () => {
    await new PrismaLeasesRepository().getCancellationPreview(lease.id, '2026-09-01');
    expect(mocks.transactionFind.mock.calls[0][0].where).toMatchObject({
      lease_id: lease.id,
      effective_date: { gte: new Date('2026-09-01T00:00:00Z') },
    });
    expect(mocks.transactionFind.mock.calls[0][0].where.effective_date).not.toHaveProperty('lte');
  });

  it('exclui automaticamente pendentes da locação sem apagar concluídos ou encargos', async () => {
    const result = await new PrismaLeasesRepository().cancel(lease.id, {
      date: '2026-09-01', cancellation_penalty: 150,
    }, 'company');
    expect(mocks.transactionUpdate.mock.calls[0][0].where).toMatchObject({
      lease_id: lease.id,
      company_id: 'company',
      deleted_at: null,
      is_cancellation_charge: false,
      status: { not: 'COMPLETED' },
      effective_date: { gte: new Date('2026-09-01T00:00:00Z') },
    });
    expect(mocks.leaseUpdate.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELED',
      canceled_at: new Date('2026-09-01T00:00:00Z'),
      cancellation_penalty: 150,
    });
    expect(result?.deleted).toBe(2);
  });

  it('respeita a seleção explícita do modal detalhado', async () => {
    await new PrismaLeasesRepository().cancel(lease.id, {
      date: '2026-09-01', transactionIds: ['selected'],
    }, 'company');
    const where = mocks.transactionUpdate.mock.calls[0][0].where;
    expect(where.id).toEqual({ in: ['selected'] });
    expect(where).not.toHaveProperty('status');
    expect(where).not.toHaveProperty('effective_date');
  });
});
