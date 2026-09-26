import { describe, expect, it } from 'vitest';
import { canAccessCompany } from '../company-access';

describe('company scope is independent from role', () => {
  it('limits administrators to their home company without additional grants', () => {
    const user = { role: 'ADMIN', company_id: 'one' };
    expect(canAccessCompany(user, 'one')).toBe(true);
    expect(canAccessCompany(user, 'two')).toBe(false);
  });
  it('allows a manager in selected companies and revokes removed grants', () => {
    const user = { role: 'DEFAULT', company_id: 'one', allowed_company_ids: ['three'] };
    expect(canAccessCompany(user, 'three')).toBe(true);
    expect(canAccessCompany(user, 'two')).toBe(false);
    expect(canAccessCompany({ ...user, allowed_company_ids: [] }, 'three')).toBe(false);
  });
  it('supports all companies without changing the role', () => {
    expect(canAccessCompany({ role: 'ADMIN', all_companies_access: true }, 'new-company')).toBe(true);
    expect(canAccessCompany({ role: 'SUPER_ADMIN' }, 'any-company')).toBe(true);
  });
});
