import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ withTenant: vi.fn(), suggest: vi.fn() }));
vi.mock('@/infra/auth/session', () => ({ withTenant: mocks.withTenant }));
vi.mock('@/infra/geocoding/property-suggestion', () => ({ suggestPropertyLocation: mocks.suggest }));
import { POST } from './route';
import { UnauthorizedError } from '@/core/errors/domain-errors';

const payload = { street: 'Rua A', number: '55', city: 'Garça', state: 'SP' };
const request = (body: unknown) => new NextRequest('http://localhost/api/properties/location-suggestion', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  mocks.withTenant.mockReset().mockImplementation(fn => fn({ company_id: 'tenant-test' }));
  mocks.suggest.mockReset().mockResolvedValue({ status: 'ok', suggestion: null });
});
it('requires authentication before calling the provider', async () => {
  mocks.withTenant.mockRejectedValue(new UnauthorizedError('Faça login'));
  expect((await POST(request(payload))).status).toBe(401);
  expect(mocks.suggest).not.toHaveBeenCalled();
});
it('rejects incomplete addresses before calling the provider', async () => {
  expect((await POST(request({ ...payload, number: '' }))).status).toBe(400);
  expect(mocks.suggest).not.toHaveBeenCalled();
});
it('uses the authenticated tenant and disables HTTP caching', async () => {
  const response = await POST(request(payload));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(mocks.suggest).toHaveBeenCalledWith(expect.objectContaining(payload), 'tenant-test');
});
