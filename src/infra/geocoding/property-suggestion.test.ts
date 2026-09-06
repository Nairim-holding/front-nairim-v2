import { afterEach, expect, it, vi } from 'vitest';
import { selectSuggestion, suggestPropertyLocation } from './property-suggestion';

const address = { street: 'Av. Dr. Rafael Paes de Barros', number: '55', city: 'Garça', state: 'SP', district: 'Williams', zip_code: '17404-340', country: 'Brasil' };
const result = { lat: -22.2128484, lon: -49.6530038, city: 'Garça', state_code: 'SP', country_code: 'br', result_type: 'building', street: 'Avenida Doutor Rafael Paes de Barros', housenumber: '55' };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('prefers a matching building over a street suggestion', () => {
  expect(selectSuggestion([{ ...result, result_type: 'street' }, result], address)?.precision).toBe('address');
});
it('labels street and neighborhood results as approximate', () => {
  for (const type of ['street', 'suburb', 'district']) expect(selectSuggestion([{ ...result, result_type: type }], address)?.precision).toBe('approximate');
});
it.each([{ city: 'Marília' }, { state_code: 'PR' }, { country_code: 'us' }, { housenumber: '56' }, { result_type: 'city' }, { street: 'Rua diferente' }, { lat: 100 }, { lon: null }])('rejects mismatches and invalid points: %j', change => {
  expect(selectSuggestion([{ ...result, ...change }], address)).toBeNull();
});
it('returns an explicit unconfigured state without a provider call', async () => {
  vi.stubEnv('GEOAPIFY_API_KEY', '');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect((await suggestPropertyLocation(address, 'missing-key')).status).toBe('unconfigured');
  expect(fetch).not.toHaveBeenCalled();
});
it('caches successful queries per tenant and never returns the key', async () => {
  vi.stubEnv('GEOAPIFY_API_KEY', 'test-only-key');
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ results: [result] })));
  vi.stubGlobal('fetch', fetch);
  const first = await suggestPropertyLocation(address, 'cache-a');
  expect(await suggestPropertyLocation(address, 'cache-a')).toEqual(first);
  expect(fetch).toHaveBeenCalledTimes(1);
  await suggestPropertyLocation(address, 'cache-b');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(first)).not.toContain('test-only-key');
});
it('degrades gracefully when the provider fails', async () => {
  vi.stubEnv('GEOAPIFY_API_KEY', 'test-only-key');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
  expect(await suggestPropertyLocation(address, 'failure')).toEqual({ status: 'unavailable', suggestion: null });
});
