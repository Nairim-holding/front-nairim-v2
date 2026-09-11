import { beforeEach, expect, it, vi } from 'vitest';
import { runWithTenant } from '@/infra/database/tenant-context';

const mocks = vi.hoisted(() => ({ find: vi.fn(), findOne: vi.fn(), count: vi.fn(), sort: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: {} }));
vi.mock('@/infra/database/mongodb', () => ({ logsCollection: async () => ({ find: mocks.find, findOne: mocks.findOne, countDocuments: mocks.count }) }));
import { MongoAuditLogsRepository } from './mongo-audit-logs-repository';
const repo = new MongoAuditLogsRepository();
beforeEach(() => {
  vi.clearAllMocks();
  const cursor = { sort: mocks.sort, skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) };
  mocks.sort.mockReturnValue(cursor); mocks.find.mockReturnValue(cursor);
  mocks.count.mockResolvedValue(0); mocks.findOne.mockResolvedValue(null);
});
it('fails closed without a tenant', async () => {
  await expect(repo.list({})).rejects.toThrow('Contexto de empresa');
  await expect(repo.findById('x')).rejects.toThrow('Contexto de empresa');
  expect(mocks.find).not.toHaveBeenCalled();
});
it('scopes detail lookup even with a known foreign UUID', async () => {
  await runWithTenant('company-a', () => repo.findById('foreign-id'));
  expect(mocks.findOne).toHaveBeenCalledWith({ company_id: 'company-a', id: 'foreign-id' });
});
it('escapes regular expressions and ignores injected tenant filters', async () => {
  await runWithTenant('a', () => repo.list({ search: '.*', filters: { company_id: 'b' }, sortOptions: { created_at: 'desc' } }));
  expect(mocks.find).toHaveBeenCalledWith({ company_id: 'a', $or: [
    { user_name: { $regex: '\\.\\*', $options: 'i' } }, { user_email: { $regex: '\\.\\*', $options: 'i' } },
  ] });
  expect(mocks.sort).toHaveBeenCalledWith({ created_at: -1, id: -1 });
});
