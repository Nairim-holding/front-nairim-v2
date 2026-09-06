import { expect, it } from 'vitest';
import { buildPropertyFormData, transformPropertyData } from '@/app/dashboard/(cadastro)/imoveis/_lib/propertyTransform';
import { createUnifiedPropertySchema } from '@/shared/validators/property';
import { isLocationConfirmed, locationConfirmation, resolveLocation } from './property-location';

const address = { street: 'Rua A', number: '55', city: 'Garça', state: 'SP', district: 'Williams', country: 'Brasil', zip_code: '17404-340', latitude: -22.2128484, longitude: -49.6530038 };
const property = { title: 'Imóvel', bedrooms: 1, bathrooms: 1, area_total: 50, furnished: false, tax_registration: '1', owner_id: 'owner', type_id: 'type' };

it('preserves confirmation through form load, serialization, validation and persistence', () => {
  const saved = { ...address, location_confirmation: locationConfirmation(address) };
  const form = transformPropertyData({ ...property, addresses: [{ address: saved }] });
  const fd = buildPropertyFormData(form, 'user');
  const outgoing = JSON.parse(String(fd.get('addressData')));
  const parsed = createUnifiedPropertySchema.parse({ ...property, address: outgoing }).address!;
  expect(parsed.location_update).toBe(true);
  expect(isLocationConfirmed({ ...parsed, ...resolveLocation(parsed, saved) })).toBe(true);
});

it('does not carry confirmation onto a changed address when saving the form', () => {
  const saved = { ...address, location_confirmation: locationConfirmation(address) };
  const form = transformPropertyData({ ...property, addresses: [{ address: saved }] });
  form.number = '56';
  const fd = buildPropertyFormData(form, 'user');
  const outgoing = JSON.parse(String(fd.get('addressData')));
  expect(resolveLocation(outgoing, saved)).toEqual({ latitude: null, longitude: null, location_confirmation: null });
});

it.each([
  { latitude: 91, longitude: 0 },
  { latitude: 0, longitude: 181 },
  { latitude: 'not-a-number', longitude: 0 },
  { latitude: 1, longitude: null },
])('rejects malformed coordinates at the server boundary: %j', point => {
  expect(createUnifiedPropertySchema.safeParse({ ...property, address: { ...address, ...point } }).success).toBe(false);
});

it('allows an address without a point to be saved for later review', () => {
  const result = createUnifiedPropertySchema.parse({ ...property, address: { ...address, latitude: '', longitude: '' } });
  expect(result.address?.latitude).toBeNull();
  expect(result.address?.longitude).toBeNull();
});
