import { describe, expect, it } from 'vitest';
import { coordinate, isLocationConfirmed, locationConfirmation, resolveLocation, type LocationAddress } from './property-location';

const address: LocationAddress = {
  street: 'Avenida Doutor Rafael Paes de Barros', number: '55', district: 'Williams',
  city: 'Garça', state: 'SP', country: 'Brasil', zip_code: '17404-340',
  latitude: -22.2128484, longitude: -49.6530038,
};
const confirmed = { ...address, location_confirmation: locationConfirmation(address) };

describe('property location confirmation', () => {
  it('keeps legacy coordinates pending, even when they look valid', () => {
    expect(isLocationConfirmed(address)).toBe(false);
    expect(resolveLocation(address).location_confirmation).toBeNull();
  });
  it('accepts explicit confirmation for the current address and point', () => {
    expect(isLocationConfirmed(confirmed)).toBe(true);
    expect(resolveLocation({ ...confirmed, location_update: true })).toMatchObject(confirmedPoint());
  });
  it('does not accept a confirmation without an explicit location update', () => {
    expect(resolveLocation(confirmed).location_confirmation).toBeNull();
  });
  it('protects a confirmed point from automatic coordinate replacement', () => {
    expect(resolveLocation({ ...address, latitude: -22.2198289, longitude: -49.6491339 }, confirmed)).toEqual(confirmedPoint());
  });
  it.each(['street', 'number', 'district', 'city', 'state', 'country', 'zip_code', 'block', 'lot', 'complement'] as const)('invalidates confirmation after changing %s', key => {
    const changed = { ...confirmed, [key]: 'changed', location_update: true };
    expect(isLocationConfirmed(changed)).toBe(false);
    expect(resolveLocation(changed, confirmed)).toEqual({ latitude: null, longitude: null, location_confirmation: null });
  });
  it('allows a newly confirmed point after changing the address', () => {
    const next = { ...address, number: '64', latitude: -22.213, location_update: true };
    expect(resolveLocation({ ...next, location_confirmation: locationConfirmation(next) }, confirmed).location_confirmation).toBe(locationConfirmation(next));
  });
  it('requires reconfirmation after dragging the point', () => {
    const next = { ...confirmed, latitude: -22.214, location_update: true };
    expect(resolveLocation(next, confirmed).location_confirmation).toBeNull();
  });
  it('allows explicit removal of a confirmed point', () => {
    expect(resolveLocation({ ...address, latitude: null, longitude: null, location_update: true }, confirmed)).toEqual({ latitude: null, longitude: null, location_confirmation: null });
  });
  it.each([null, undefined, '', ' ', false, Infinity, NaN, 'invalid', 91])('rejects invalid latitude %s', value => {
    expect(coordinate(value, 90)).toBeNull();
    expect(locationConfirmation({ ...address, latitude: value })).toBeNull();
  });
  it('preserves zero coordinates and treats numeric strings consistently', () => {
    expect(coordinate(0, 90)).toBe(0);
    expect(locationConfirmation({ ...address, latitude: String(address.latitude) })).toBe(locationConfirmation(address));
  });
});

function confirmedPoint() {
  return { latitude: address.latitude, longitude: address.longitude, location_confirmation: confirmed.location_confirmation };
}
