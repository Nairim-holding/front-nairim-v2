import { describe, expect, it, vi } from 'vitest';
import { occupancyDate, releaseExpiredProperties, syncPropertyOccupancy } from './property-occupancy';
import { runWithTenant } from '@/infra/database/tenant-context';

function client(active = 0) {
  return {
    property: { findFirst: vi.fn().mockResolvedValue({ id: 'p' }), findMany: vi.fn().mockResolvedValue([{ values: [{ id: 'v', status: 'OCCUPIED' }] }]) },
    propertyValue: { findFirst: vi.fn().mockResolvedValue({ id: 'v', status: 'OCCUPIED' }), update: vi.fn(), updateMany: vi.fn() },
    lease: { count: vi.fn().mockResolvedValue(active) },
  };
}
describe('property occupancy', () => {
  it('keeps the expiration day through midnight in São Paulo', () => {
    expect(occupancyDate(new Date('2026-08-31T02:59:59Z')).toISOString()).toBe('2026-08-30T00:00:00.000Z');
    expect(occupancyDate(new Date('2026-08-31T03:00:00Z')).toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });
  it.each([0, 1])('recalculates after lease mutations with %i valid contracts', async active => {
    const db = client(active);
    await runWithTenant('company-a', () => syncPropertyOccupancy(db as never, 'p'));
    if (active) expect(db.propertyValue.update).not.toHaveBeenCalled();
    else expect(db.propertyValue.update).toHaveBeenCalledWith({ where: { id: 'v' }, data: { status: 'AVAILABLE' } });
    expect(db.lease.count.mock.calls[0][0].where).toMatchObject({ company_id: 'company-a', deleted_at: null, status: { not: 'CANCELED' }, end_date: { gte: expect.any(Date) } });
  });
  it('rechecks absence of another valid lease when releasing expired properties', async () => {
    const db = client();
    await runWithTenant('company-a', () => releaseExpiredProperties(db as never));
    const where = db.propertyValue.updateMany.mock.calls[0][0].where;
    expect(where.id.in).toEqual(['v']);
    expect(where.property.company_id).toBe('company-a');
    expect(where.property.AND[1].leases.none.end_date.gte).toBeInstanceOf(Date);
  });
  it('never runs reconciliation globally without a tenant', async () => {
    const db = client();
    await releaseExpiredProperties(db as never);
    expect(db.property.findMany).not.toHaveBeenCalled();
  });
});
