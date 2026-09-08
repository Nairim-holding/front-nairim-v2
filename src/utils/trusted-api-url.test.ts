import { describe, expect, it } from 'vitest';
import { isTrustedApiUrl } from './trusted-api-url';

describe('credential destination boundaries', () => {
  const page = 'https://app.example.test/dashboard';
  const api = 'https://api.example.test/api';
  it.each(['https://api.example.test.evil.test/api', 'https://api.example.test@evil.test/api', 'https://api.example.test/api-evil', 'http://api.example.test/api', 'https://api.example.test:444/api', 'https://api.example.test/api/../private'])
   ('does not send a token to %s', (target) => expect(isTrustedApiUrl(target, api, page)).toBe(false));
  it('accepts only the configured origin and API path', () => {
    expect(isTrustedApiUrl(`${api}/users`, api, page)).toBe(true);
    expect(isTrustedApiUrl('/api/users', '/api', page)).toBe(true);
    expect(isTrustedApiUrl('/dashboard', '/api', page)).toBe(false);
    expect(isTrustedApiUrl('/api/users', '', page)).toBe(false);
  });
});
