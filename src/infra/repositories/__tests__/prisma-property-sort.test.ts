import { describe, expect, it, vi } from 'vitest';
const find = vi.hoisted(() => vi.fn());
vi.mock('@/infra/database/prisma', () => ({ default: { property: { findMany: find } } }));
vi.mock('../property-occupancy', () => ({ releaseExpiredProperties: vi.fn() }));
import { PrismaPropertiesRepository } from '../prisma-properties-repository';

describe('property availability sorting', () => {
  it('sorts the latest status before slicing the page in both directions', async () => {
    find.mockResolvedValue(['SOLD', 'OCCUPIED', 'AVAILABLE'].map((status, i) => ({
      id: String(i), title: status, values: [{ status }], documents: [],
    })));
    const repo = new PrismaPropertiesRepository();
    const params = { page: 1, limit: 2, filters: {}, includeInactive: false, sortOptions: { 'values.status': 'asc' } };
    const first = await repo.list(params);
    expect(first.data.map(row => row.title)).toEqual(['AVAILABLE', 'OCCUPIED']);
    expect(first.count).toBe(3);
    const reversed = await repo.list({ ...params, sortOptions: { 'values.status': 'desc' } });
    expect(reversed.data.map(row => row.title)).toEqual(['SOLD', 'OCCUPIED']);
  });
});
