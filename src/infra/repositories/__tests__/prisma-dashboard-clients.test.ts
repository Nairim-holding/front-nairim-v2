import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  owner: { findMany: vi.fn(), count: vi.fn() }, tenant: { findMany: vi.fn(), count: vi.fn() },
  agency: { findMany: vi.fn(), count: vi.fn() }, property: { findMany: vi.fn(), count: vi.fn() },
}));
vi.mock('@/infra/database/prisma', () => ({ default: db }));
vi.mock('../property-occupancy', () => ({ releaseExpiredProperties: vi.fn() }));
import { PrismaDashboardRepository } from '../prisma-dashboard-repository';

const property = (id: string, status = 'AVAILABLE', type = 'Casa') => ({
  id, title: id, area_total: 100, type: { description: type }, values: [{ status, rental_value: 2000 }], documents: [], leases: [],
});
const start = new Date('2026-09-01T00:00:00Z');
const end = new Date('2026-09-30T00:00:00Z');

describe('dashboard portfolios and owner totals', () => {
  beforeEach(() => vi.resetAllMocks());
  it('counts existing owners, tenants and agencies through the selected end, with actual previous averages', async () => {
    db.owner.findMany.mockResolvedValue([{ id: 'owner', name: 'Maria', properties: [property('p1'), property('p2')] }]);
    db.owner.count.mockResolvedValue(1);
    db.tenant.findMany.mockResolvedValue([{ id: 'tenant', name: 'Ana', leases: [] }]);
    db.tenant.count.mockResolvedValue(1);
    db.agency.findMany.mockResolvedValue([{ id: 'agency', trade_name: 'Imobiliária', properties: [property('p1')] }]);
    db.agency.count.mockResolvedValue(1);
    db.property.count.mockResolvedValue(1);
    const result = await new PrismaDashboardRepository().getClients(start, end);
    expect(result.ownersTotal.result).toBe(1);
    expect(result.tenantsTotal.result).toBe(1);
    expect(result.agenciesTotal.result).toBe(1);
    expect(result.propertiesPerOwner).toMatchObject({ result: 2, variation: 100 });
    expect(result.propertiesByAgency[0]).toMatchObject({ name: 'Imobiliária', value: 1 });
    for (const find of [db.owner.findMany, db.tenant.findMany, db.agency.findMany]) {
      expect(find.mock.calls[0][0].where.created_at).toEqual({ lte: end });
    }
  });
  it('counts all property types and sold properties separately from occupation and vacancy', async () => {
    db.property.findMany.mockResolvedValueOnce([
      property('available'), property('occupied', 'OCCUPIED'), property('sold', 'SOLD', 'Terreno'),
    ]).mockResolvedValueOnce([]);
    const result = await new PrismaDashboardRepository().getPortfolio(start, end);
    expect(result.propertiesByType).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Casa', value: 2 }), expect.objectContaining({ name: 'Terreno', value: 1 }),
    ]));
    expect(result.propertiesByStatus?.map(row => row.value)).toEqual([1, 1, 1]);
    expect(result.occupationRate.result).toBe(50);
    expect(result.vacancyRate.result).toBe(50);
    expect(result.availablePropertiesByType[0]).toMatchObject({ name: 'Casa', value: 1 });
    expect(result.availablePropertiesByType[0].data).toHaveLength(1);
  });
});
