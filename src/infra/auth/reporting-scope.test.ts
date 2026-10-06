import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DecodedSessionToken } from '@/core/cryptography/token-signer';
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: { company: { findMany } } }));
vi.mock('./session', () => ({ assertSuperAdmin: (session: DecodedSessionToken) => { if (session.role !== 'SUPER_ADMIN') throw new Error('Acesso negado'); } }));
import { withReportingScope } from './reporting-scope';
import { getReportingCompanyIds } from '@/infra/database/reporting-context';
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const session = { role: 'SUPER_ADMIN', company_id: a } as DecodedSessionToken;
describe('reporting scope authorization', () => {
  beforeEach(() => findMany.mockReset());
  it('uses the current tenant without extra queries by default', async () => {
    expect(await withReportingScope({ ...session, role: 'ADMIN' }, {}, async () => getReportingCompanyIds())).toBeUndefined();
    expect(findMany).not.toHaveBeenCalled();
  });
  it('rejects company selection from non-root users before any read', async () => {
    const read = vi.fn();
    await expect(withReportingScope({ ...session, role: 'ADMIN' }, { company_ids: [a, b] }, read)).rejects.toThrow('Acesso negado');
    expect(read).not.toHaveBeenCalled(); expect(findMany).not.toHaveBeenCalled();
  });
  it('rejects missing, inactive or deleted companies', async () => {
    findMany.mockResolvedValue([{ id: a }]);
    const read = vi.fn();
    await expect(withReportingScope(session, { company_ids: [a, b] }, read)).rejects.toThrow('empresas ativas');
    expect(read).not.toHaveBeenCalled();
    expect(findMany.mock.calls[0][0].where).toMatchObject({ deleted_at: null, is_active: true });
  });
  it('validates identifiers and establishes a deduplicated temporary read scope', async () => {
    await expect(withReportingScope(session, { company_ids: ['invalid'] }, async () => null)).rejects.toThrow();
    findMany.mockResolvedValue([{ id: a }, { id: b }]);
    expect(await withReportingScope(session, { company_ids: [a, b, a] }, async () => getReportingCompanyIds())).toEqual([a, b]);
    expect(getReportingCompanyIds()).toBeUndefined();
  });
});
