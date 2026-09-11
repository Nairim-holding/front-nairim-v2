import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { id: 'user-a', company_id: 'company-a', role: 'ADMIN' },
  permission: true,
  count: vi.fn(), pending: vi.fn(), deleteLogs: vi.fn(), findPreview: vi.fn(), deletePreview: vi.fn(),
  insertPreview: vi.fn(), lock: vi.fn(),
}));
vi.mock('@/infra/auth/session', () => ({
  assertAdmin: (session: { role: string }) => { if (session.role !== 'ADMIN') throw new Error('Forbidden'); },
  withPermission: async (_resource: string, _action: string, fn: (session: typeof mocks.session) => unknown) => {
    if (!mocks.permission) throw new Error('Forbidden');
    return fn(mocks.session);
  },
}));
vi.mock('@/infra/database/prisma', () => ({ default: {
  $transaction: (fn: (tx: unknown) => unknown) => fn({ $executeRaw: mocks.lock, auditLogOutbox: { count: mocks.pending } }),
} }));
vi.mock('@/infra/database/mongodb', () => ({
  logsCollection: async () => ({ countDocuments: mocks.count, deleteMany: mocks.deleteLogs }),
  logsDatabase: async () => ({ collection: () => ({ createIndex: vi.fn(), insertOne: mocks.insertPreview, findOne: mocks.findPreview, deleteOne: mocks.deletePreview }) }),
}));
import { previewLogPurgeAction, purgeLogsAction } from './log-management';

const token = 'ba8a73cf-bb68-4d34-9956-60ecbca55ace';
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.role = 'ADMIN'; mocks.permission = true;
  mocks.pending.mockResolvedValue(0); mocks.count.mockResolvedValue(2);
  mocks.findPreview.mockResolvedValue({ _id: token, company_id: 'company-a', user_id: 'user-a', count: 2, selection: { mode: 'all' }, cutoff: new Date('2026-09-11T12:00:00Z') });
  mocks.deleteLogs.mockResolvedValue({ deletedCount: 2 });
});
describe('purge authorization and confirmation', () => {
  it('requires both administrator and resource permission', async () => {
    mocks.session.role = 'DEFAULT';
    expect((await previewLogPurgeAction({ mode: 'all' })).ok).toBe(false);
    mocks.session.role = 'ADMIN'; mocks.permission = false;
    expect((await purgeLogsAction({ token, confirmation: 'EXCLUIR LOGS' })).ok).toBe(false);
    expect(mocks.deleteLogs).not.toHaveBeenCalled();
  });
  it('does not delete without exact confirmation', async () => {
    expect((await purgeLogsAction({ token, confirmation: 'sim' })).ok).toBe(false);
    expect(mocks.deleteLogs).not.toHaveBeenCalled();
  });
  it('refuses a purge while deliveries can still be replayed', async () => {
    mocks.pending.mockResolvedValue(1);
    expect((await purgeLogsAction({ token, confirmation: 'EXCLUIR LOGS' })).ok).toBe(false);
    expect(mocks.deleteLogs).not.toHaveBeenCalled();
  });
  it('rejects expired, missing or other-user previews', async () => {
    mocks.findPreview.mockResolvedValue(null);
    expect((await purgeLogsAction({ token, confirmation: 'EXCLUIR LOGS' })).ok).toBe(false);
    expect(mocks.findPreview).toHaveBeenCalledWith(expect.objectContaining({ company_id: 'company-a', user_id: 'user-a', expires_at: { $gt: expect.any(Date) } }));
    expect(mocks.deleteLogs).not.toHaveBeenCalled();
  });
  it('requires another preview when the count has changed', async () => {
    mocks.count.mockResolvedValue(3);
    expect((await purgeLogsAction({ token, confirmation: 'EXCLUIR LOGS' })).ok).toBe(false);
    expect(mocks.deleteLogs).not.toHaveBeenCalled();
  });
  it('deletes only the confirmed tenant and ingestion cutoff', async () => {
    const result = await purgeLogsAction({ token, confirmation: 'EXCLUIR LOGS' });
    expect(result).toEqual({ ok: true, data: { deleted: 2 } });
    expect(mocks.deleteLogs).toHaveBeenCalledWith({ company_id: 'company-a', ingested_at: { $lte: new Date('2026-09-11T12:00:00Z') } }, expect.any(Object));
    expect(mocks.deletePreview).toHaveBeenCalledWith({ _id: token });
  });
});
