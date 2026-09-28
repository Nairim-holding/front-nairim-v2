export type PropertyMapStatus = 'OCCUPIED' | 'AVAILABLE' | 'SOLD';

/** A venda prevalece sobre qualquer locação anterior do imóvel. */
export function getPropertyMapStatus(point: { status?: string; isLeased?: boolean }): PropertyMapStatus {
  if (point.status === 'SOLD') return 'SOLD';
  return point.isLeased || point.status === 'OCCUPIED' ? 'OCCUPIED' : 'AVAILABLE';
}
