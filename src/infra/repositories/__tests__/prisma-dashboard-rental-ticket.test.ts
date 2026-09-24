import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  propertyFind: vi.fn(), leaseFind: vi.fn(), transactionFind: vi.fn(),
}));

vi.mock('../property-occupancy', () => ({ releaseExpiredProperties: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({
  default: {
    property: { findMany: mocks.propertyFind },
    lease: { findMany: mocks.leaseFind },
    transaction: { findMany: mocks.transactionFind },
  },
}));

import { PrismaDashboardRepository } from '../prisma-dashboard-repository';

const lease = (id: string, propertyId: string) => ({
  id, property_id: propertyId, contract_number: id,
  start_date: new Date('2025-01-01T00:00:00Z'),
  end_date: new Date('2027-12-31T00:00:00Z'), canceled_at: null,
  property: { title: propertyId, area_total: 100, type: { description: 'Casa' }, owner: { name: 'Proprietário' } },
});
const rent = (leaseId: string | null, amount: number) => ({
  lease_id: leaseId, amount, description: `Aluguel - Contrato ${leaseId}`,
  effective_date: new Date('2026-09-15T00:00:00Z'),
  is_cancellation_charge: false, category: { type: 'INCOME' }, subcategory: { name: 'Aluguéis' },
});

describe('ticket médio da locação', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.propertyFind.mockResolvedValue([]);
    mocks.leaseFind.mockResolvedValue([
      lease('contract-a1', 'property-a'),
      lease('contract-a2', 'property-a'),
      lease('contract-b', 'property-b'),
    ]);
    mocks.transactionFind
      .mockResolvedValueOnce([
        rent('contract-a1', 100), rent('contract-a2', 200), rent('contract-b', 300),
        { ...rent('contract-b', 500), description: 'Comissão - Contrato contract-b', category: { type: 'EXPENSE' } },
      ])
      .mockResolvedValueOnce([rent('contract-a1', 200)]);
  });

  it('divide a receita bruta do período pelo número de imóveis distintos', async () => {
    const result = await new PrismaDashboardRepository().getFinancial(
      new Date('2026-09-01T00:00:00Z'), new Date('2026-09-30T00:00:00Z'),
    );
    expect(result.averageRentalTicket.result).toBe(300);
    expect(result.averageRentalTicket.variation).toBe(50);
    expect(result.averageRentalTicket.data).toHaveLength(2);
    expect(result.averageRentalTicket.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'property-a', rentalValue: 300 }),
      expect.objectContaining({ id: 'property-b', rentalValue: 300 }),
    ]));
    expect(mocks.transactionFind.mock.calls[0][0].where).toMatchObject({
      status: 'COMPLETED', deleted_at: null, is_transfer: false,
      effective_date: {
        gte: new Date('2026-09-01T00:00:00Z'),
        lte: new Date('2026-09-30T00:00:00Z'),
      },
    });
  });
});
