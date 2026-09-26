import { beforeEach, describe, expect, it, vi } from 'vitest';

const user = vi.hoisted(() => vi.fn());
vi.mock('@/infra/database/prisma', () => ({ default: { user: { findFirst: user } } }));
import { PrismaUserGroupPermissionsRepository } from './prisma-user-group-permissions-repository';
import { runWithTenant } from '@/infra/database/tenant-context';
import { GetMyPermissionsUseCase } from '@/core/use-cases/permission/get-my-permissions';

const repo = new PrismaUserGroupPermissionsRepository();
const resolve = () => runWithTenant('a', () => repo.resolveForUser('user-a'));
beforeEach(() => vi.resetAllMocks());

describe('permission revocation', () => {
  it.each([
    null,
    { company_id: 'a', role: 'ADMIN', user_group_id: 'g', group: null },
    { company_id: 'a', role: 'ADMIN', user_group_id: 'g', group: { deleted_at: new Date(), company_id: 'a' } },
    { company_id: 'a', role: 'ADMIN', user_group_id: 'g', group: { deleted_at: null, company_id: 'b' } },
  ])('denies missing accounts and invalid groups', async (record) => {
    user.mockResolvedValue(record);
    expect(await resolve()).toEqual(new Map());
  });
  it('does not reuse permission grants after they have been revoked', async () => {
    user.mockResolvedValueOnce({ company_id: 'a', role: 'ADMIN', user_group_id: 'g', group: { deleted_at: null, company_id: 'a', permissions: [{ company_id: 'a', resource: 'leases', can_edit: true }] } });
    expect((await resolve())?.get('leases')?.has('edit')).toBe(true);
    user.mockResolvedValueOnce({ company_id: 'a', role: 'ADMIN', user_group_id: 'g', group: { deleted_at: null, company_id: 'a', permissions: [] } });
    expect(await resolve()).toEqual(new Map());
    expect(user).toHaveBeenCalledTimes(2);
  });
  it('does not return unrestricted frontend permissions for an ordinary user without a group', async () => {
    user.mockResolvedValue({ company_id: 'a', role: 'ADMIN', user_group_id: null, group: null });
    const useCase = new GetMyPermissionsUseCase(repo);
    const output = await runWithTenant('a', () => useCase.execute('user-a', 'DEFAULT'));
    expect(output.unrestricted).toBe(false);
    expect(output.resources.leases.view).toBe(false);
    const admin = await runWithTenant('a', () => useCase.execute('user-a', 'ADMIN'));
    expect(admin.unrestricted).toBe(true);
  });
});

describe('permissions across authorized companies', () => {
  it('keeps the home group restrictions in a granted company and rejects revocation', async () => {
    const identity = { company_id: 'a', role: 'ADMIN', allowed_company_ids: ['b'], user_group_id: 'g',
      group: { company_id: 'a', deleted_at: null, permissions: [{ company_id: 'a', resource: 'leases', can_view: true, can_edit: false }] } };
    user.mockResolvedValue(identity);
    const grants = await runWithTenant('b', () => repo.resolveForUser('user-a'));
    expect(grants?.get('leases')?.has('view')).toBe(true);
    expect(grants?.get('leases')?.has('edit')).toBe(false);
    user.mockResolvedValue({ ...identity, allowed_company_ids: [] });
    expect(await runWithTenant('b', () => repo.resolveForUser('user-a'))).toEqual(new Map());
  });
});
