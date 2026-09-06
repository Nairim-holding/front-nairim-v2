import { afterEach, expect, it, vi } from 'vitest';
import { GET } from './[cep]/route';
import { NextRequest } from 'next/server';

afterEach(() => vi.unstubAllGlobals());

it('fills postal address without calling a geocoder or returning a pin', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ cep: '17404-340', logradouro: 'Avenida Doutor Rafael Paes de Barros', bairro: 'Williams', localidade: 'Garça', uf: 'SP', complemento: '' }));
  vi.stubGlobal('fetch', fetch);
  const response = await GET(new NextRequest('http://localhost/api/cep/17404340?numero=55'), { params: Promise.resolve({ cep: '17404340' }) });
  const data = await response.json();
  expect(data.cidade).toBe('Garça');
  expect(data).not.toHaveProperty('latitude');
  expect(data).not.toHaveProperty('longitude');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain('viacep.com.br');
});
