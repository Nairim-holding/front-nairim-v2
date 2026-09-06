import { coordinate } from '@/shared/utils/property-location';
import type { LocationSuggestion, SuggestionAddress } from '@/shared/validators/location-suggestion';

interface Result {
  lat?: unknown; lon?: unknown; country_code?: string; city?: string;
  state_code?: string; result_type?: string; housenumber?: string; street?: string;
  formatted?: string;
}
const normalize = (s: string = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const streetName = (s: string = '') => normalize(s).replace(/\b(av|dr|r)\./g, '$1').replace(/\b(av|avenida|rua|r|doutor|dr)\b/g, '').replace(/\s+/g, ' ').trim();

export function selectSuggestion(results: Result[], address: SuggestionAddress): LocationSuggestion | null {
  const suggestions = results.flatMap(result => {
    const lat = coordinate(result.lat, 90), lng = coordinate(result.lon, 180);
    if (lat === null || lng === null || result.country_code !== 'br'
      || normalize(result.city) !== normalize(address.city)
      || normalize(result.state_code?.replace(/^BR-/i, '')) !== normalize(address.state)) return [];
    const type = result.result_type;
    if (!['building', 'street', 'suburb', 'district'].includes(type ?? '')) return [];
    if (type === 'building' && (normalize(result.housenumber) !== normalize(address.number) || streetName(result.street) !== streetName(address.street))) return [];
    if (type === 'street' && streetName(result.street) !== streetName(address.street)) return [];
    return [{ latitude: lat, longitude: lng, precision: type === 'building' ? 'address' as const : 'approximate' as const, label: String(result.formatted ?? '').slice(0, 500) }];
  });
  return suggestions.find(s => s.precision === 'address') ?? suggestions[0] ?? null;
}

const cache = new Map<string, { expires: number; value: LocationSuggestion | null }>();

export async function suggestPropertyLocation(address: SuggestionAddress, tenant: string): Promise<{ status: 'ok' | 'unconfigured' | 'unavailable'; suggestion: LocationSuggestion | null }> {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) return { status: 'unconfigured', suggestion: null };
  if (!['brasil', 'brazil', 'br'].includes(normalize(address.country))) return { status: 'ok', suggestion: null };
  const key = JSON.stringify([tenant, address]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return { status: 'ok', suggestion: cached.value };
  const params = new URLSearchParams({
    text: [address.street, address.number, address.district, address.city, address.state, address.zip_code, 'Brasil'].filter(Boolean).join(', '),
    filter: 'countrycode:br', lang: 'pt', format: 'json', limit: '5', apiKey,
  });
  try {
    const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
    if (!response.ok) return { status: 'unavailable', suggestion: null };
    const data = await response.json();
    const suggestion = selectSuggestion(Array.isArray(data.results) ? data.results : [], address);
    if (cache.size >= 250) cache.delete(cache.keys().next().value!);
    cache.set(key, { value: suggestion, expires: Date.now() + 24 * 60 * 60 * 1000 });
    return { status: 'ok', suggestion };
  } catch {
    // Do not log provider URLs: they contain a credential and an address.
    return { status: 'unavailable', suggestion: null };
  }
}
