import { beforeEach, expect, it, vi } from 'vitest';
import { locationConfirmation } from '@/shared/utils/property-location';

const findMany = vi.hoisted(() => vi.fn());
vi.mock('@/infra/database/prisma', () => ({ default: { property: { findMany } } }));
import { PrismaDashboardRepository } from './prisma-dashboard-repository';

const address = { street: 'Rua A', number: '55', city: 'Garça', state: 'SP', latitude: -22.21, longitude: -49.65, deleted_at: null };
beforeEach(() => findMany.mockReset());

it('exposes pins only for confirmed addresses and provides review links for all pending properties', async () => {
  findMany.mockResolvedValue([
    { id: 'confirmed', title: 'Confirmado', leases: [], values: [], addresses: [{ address: { ...address, location_confirmation: locationConfirmation(address) } }] },
    { id: 'legacy', title: 'Antigo', leases: [], values: [], addresses: [{ address }] },
    { id: 'missing', title: 'Sem endereço', leases: [], values: [], addresses: [] },
    { id: 'changed', title: 'Alterado', leases: [], values: [], addresses: [{ address: { ...address, number: '56', location_confirmation: locationConfirmation(address) } }] },
  ]);
  const { coordinates } = await new PrismaDashboardRepository().getGeolocation(new Date('2026-09-01'), new Date('2026-09-30'));
  expect(coordinates).toHaveLength(4);
  expect(coordinates[0]).toMatchObject({ confirmed: true, lat: -22.21, lng: -49.65 });
  for (const point of coordinates.slice(1)) {
    expect(point).toMatchObject({ confirmed: false, lat: null, lng: null });
    expect(point.propertyId).toBeTruthy();
  }
});
