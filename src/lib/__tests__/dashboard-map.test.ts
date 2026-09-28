import { expect, it, vi } from 'vitest';

const getDashboardSectionAction = vi.hoisted(() => vi.fn());
vi.mock('@/server/actions/dashboard', () => ({ getDashboardSectionAction }));
import { fetchSection, type MapCoordinate } from '../dashboard';

it('preserva vendidos até o mapa e mantém compatibilidade com imóveis sem status explícito', async () => {
  getDashboardSectionAction.mockResolvedValue({ ok: true, data: { coordinates: [
    { info: 'Vendido', status: 'SOLD', isLeased: true, lat: '-22.2', lng: '-49.6', confirmed: true },
    { info: 'Locado', isLeased: true, lat: -22.21, lng: -49.61, confirmed: true },
    { info: 'Disponível', lat: null, lng: null, confirmed: false },
  ] } });
  const points = await fetchSection<MapCoordinate[]>('map', { startDate: '2026-09-01', endDate: '2026-09-30' });
  expect(points).toEqual([
    expect.objectContaining({ status: 'SOLD', isLeased: false, lat: -22.2, lng: -49.6 }),
    expect.objectContaining({ status: 'OCCUPIED', isLeased: true }),
    expect.objectContaining({ status: 'AVAILABLE', isLeased: false, lat: null, lng: null }),
  ]);
});
