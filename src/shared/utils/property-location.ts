/** Confirmation is bound to the address AND point; it is not an authentication token. */
export interface LocationAddress {
  zip_code?: unknown;
  street?: unknown;
  number?: unknown;
  district?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  block?: unknown;
  lot?: unknown;
  complement?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  location_confirmation?: string | null;
  location_update?: boolean;
}

const addressFields = ['zip_code', 'street', 'number', 'district', 'city', 'state', 'country', 'block', 'lot', 'complement'] as const;
const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');

export function addressIdentity(address: LocationAddress): string {
  return JSON.stringify(addressFields.map(key => key === 'zip_code'
    ? String(address[key] ?? '').replace(/\D/g, '')
    : normalize(key === 'country' ? address[key] || 'Brasil' : address[key])));
}

export function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export function locationConfirmation(address: LocationAddress): string | null {
  const lat = coordinate(address.latitude, 90);
  const lng = coordinate(address.longitude, 180);
  if (lat === null || lng === null || !address.street || !address.number || !address.city || !address.state) return null;
  return JSON.stringify([addressIdentity(address), lat, lng]);
}

export function isLocationConfirmed(address: LocationAddress): boolean {
  const expected = locationConfirmation(address);
  return expected !== null && address.location_confirmation === expected;
}

/** Automatic/legacy writers cannot replace a confirmed point for the same address. */
export function resolveLocation(next: LocationAddress, previous?: LocationAddress) {
  const sameAddress = previous && addressIdentity(previous) === addressIdentity(next);
  if (sameAddress && isLocationConfirmed(previous) && next.location_update !== true) {
    return { latitude: coordinate(previous.latitude, 90), longitude: coordinate(previous.longitude, 180), location_confirmation: previous.location_confirmation! };
  }
  const confirmed = next.location_update === true && isLocationConfirmed(next);
  if (previous && !sameAddress && !confirmed) {
    return { latitude: null, longitude: null, location_confirmation: null };
  }
  const lat = coordinate(next.latitude, 90);
  const lng = coordinate(next.longitude, 180);
  return {
    latitude: lat !== null && lng !== null ? lat : null,
    longitude: lat !== null && lng !== null ? lng : null,
    location_confirmation: confirmed ? next.location_confirmation! : null,
  };
}
