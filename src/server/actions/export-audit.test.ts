import { beforeEach, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/core/errors/domain-errors';
import { runWithAuditActor } from '@/infra/database/audit-context';
const state = vi.hoisted(() => ({ permission: vi.fn(), create: vi.fn(), role: 'ADMIN', denied: false }));
vi.mock('@/infra/database/prisma', () => ({ default: { auditLogOutbox: { create: state.create } } }));
vi.mock('@/infra/auth/session', () => ({
  withPermission: async (resource: string, action: string, fn: (session: { company_id: string; role: string }) => unknown) => {
    state.permission(resource, action);
    if (state.denied) throw new ForbiddenError('Permissão recusada');
    return runWithAuditActor({ id: 'user', name: 'Usuário', email: 'user@example.test', company_id: 'a' }, () => fn({ company_id: 'a', role: state.role }));
  },
  assertAdmin: (session: { role: string }) => { if (!['ADMIN','SUPER_ADMIN'].includes(session.role)) throw new ForbiddenError('Administrador necessário'); },
  assertSuperAdmin: (session: { role: string }) => { if (session.role !== 'SUPER_ADMIN') throw new ForbiddenError('Super administrador necessário'); },
}));
import { auditPreparedExportAction } from './export-audit';
beforeEach(() => { vi.clearAllMocks(); state.role='ADMIN'; state.denied=false; state.create.mockResolvedValue({}); });
it.each(['XLSX','PDF'] as const)('records %s with normalized resource and session-owned actor', async format => {
  expect(await auditPreparedExportAction({ resource: 'financial-transaction', format, recordCount: 42 })).toMatchObject({ ok: true });
  expect(state.permission).toHaveBeenCalledWith('financial-transactions','export');
  expect(state.create).toHaveBeenCalledWith({ data: expect.objectContaining({ company_id: 'a', user_id: 'user', action: 'EXPORT', table_name: 'Transaction', new_values: expect.objectContaining({ format, record_count: 42 }) }) });
});
it('refuses unknown modules and invalid counts without any database writes', async () => {
  for (const input of [{ resource: 'anything', recordCount: 1 },{ resource: 'repairs', recordCount: -1 },{ resource: 'repairs', recordCount: 1.5 }]) {
    expect((await auditPreparedExportAction({ ...input, format: 'XLSX' })).ok).toBe(false);
  }
  expect(state.create).not.toHaveBeenCalled();
});
it('requires export permission and preserves privileged module guards', async () => {
  state.denied=true;
  expect((await auditPreparedExportAction({ resource: 'repairs', format: 'XLSX', recordCount: 1 })).ok).toBe(false);
  state.denied=false; state.role='DEFAULT';
  for (const resource of ['companies','users','audit-logs']) expect((await auditPreparedExportAction({ resource, format: 'XLSX', recordCount: 1 })).ok).toBe(false);
  expect(state.create).not.toHaveBeenCalled();
});
it.each(['financial-reports','lease-reports','investments','repairs'])('accepts exports from %s', async resource => {
  expect((await auditPreparedExportAction({ resource, format: 'PDF', recordCount: 0 })).ok).toBe(true);
});
