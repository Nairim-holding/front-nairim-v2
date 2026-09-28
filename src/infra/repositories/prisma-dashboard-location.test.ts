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

it('keeps sold properties separate even when they have a previous lease', async () => {
  const confirmedAddress = { address: { ...address, location_confirmation: locationConfirmation(address) } };
  findMany.mockResolvedValue([
    { id: 'sold', title: 'Vendido', leases: [{ id: 'old-lease' }], values: [{ status: 'SOLD' }], addresses: [confirmedAddress] },
    { id: 'leased', title: 'Locado', leases: [{ id: 'lease' }], values: [{ status: 'AVAILABLE' }], addresses: [confirmedAddress] },
    { id: 'available', title: 'Disponível', leases: [], values: [{ status: 'AVAILABLE' }], addresses: [confirmedAddress] },
    { id: 'sold-pending', title: 'Vendido sem endereço', leases: [], values: [{ status: 'SOLD' }], addresses: [] },
  ]);
  const { coordinates } = await new PrismaDashboardRepository().getGeolocation(new Date('2026-09-01'), new Date('2026-09-30'));
  expect(coordinates).toEqual([
    expect.objectContaining({ propertyId: 'sold', status: 'SOLD', isLeased: false, confirmed: true }),
    expect.objectContaining({ propertyId: 'leased', status: 'OCCUPIED', isLeased: true }),
    expect.objectContaining({ propertyId: 'available', status: 'AVAILABLE', isLeased: false }),
    expect.objectContaining({ propertyId: 'sold-pending', status: 'SOLD', isLeased: false, confirmed: false }),
  ]);
});
