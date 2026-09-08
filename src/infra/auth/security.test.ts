import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: vi.fn(), company: vi.fn(), group: vi.fn(), permissions: vi.fn(), verify: vi.fn(),
  cookie: vi.fn(), setCookie: vi.fn(),
  createUser: vi.fn(), updateUser: vi.fn(), backup: vi.fn(), companyWrite: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: mocks.cookie, set: mocks.setCookie }),
  headers: async () => new Headers(),
}));
vi.mock('@/infra/database/prisma', () => ({ default: {
  user: { findFirst: mocks.user }, company: { findFirst: mocks.company },
  userGroup: { findFirst: mocks.group }, owner: { findFirst: mocks.group },
  financialInstitution: { findFirst: mocks.group },
} }));
vi.mock('@/infra/auth/jwt-service', () => ({ jwtService: { verify: mocks.verify } }));
vi.mock('@/infra/repositories/prisma-user-group-permissions-repository', () => ({
  prismaUserGroupPermissionsRepository: { resolveForUser: mocks.permissions },
}));
vi.mock('@/infra/factories/user-factory', () => ({ userUseCases: {
  create: { execute: mocks.createUser }, update: { execute: mocks.updateUser },
} }));
vi.mock('@/infra/factories/auth-factory', () => ({ authUseCases: {} }));
vi.mock('@/infra/factories/backup-factory', () => ({ backupUseCases: {
  export: { execute: mocks.backup }, restore: { execute: mocks.backup },
} }));
vi.mock('@/infra/factories/company-factory', () => ({ companyUseCases: {
  update: { execute: mocks.companyWrite },
} }));

import { getServerSession, withPermission, withPermissionInput } from './session';
import { validateLiveSession } from './live-session';
import { assertCanManageUser } from './user-management';
import { runWithTenant, getCurrentCompanyId } from '@/infra/database/tenant-context';
import { assertTenantReferences } from './tenant-references';
import { RefreshTokenUseCase } from '@/core/use-cases/auth/refresh-token';
import { FakeTokenSigner } from '@/core/use-cases/auth/__tests__/test-doubles';
import { createUserAction, updateUserAction } from '@/server/actions/user';
import { exportBackupAction, restoreBackupAction } from '@/server/actions/backup';
import { updateCompanyAction } from '@/server/actions/company';

const claims = {
  id: 'user-a', company_id: 'company-a', name: 'User', email: 'user@example.test',
  role: 'SUPER_ADMIN', iat: 100, exp: 200,
};
const liveUser = { id: 'user-a', company_id: 'company-a', role: 'DEFAULT', name: 'User', email: 'user@example.test' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue(liveUser);
  mocks.company.mockResolvedValue({ id: 'company-a' });
  mocks.verify.mockReturnValue(claims);
  mocks.cookie.mockReturnValue({ value: 'signed-token' });
  mocks.permissions.mockResolvedValue(new Map());
});

describe('session authority', () => {
  it('uses the current role instead of stale SUPER_ADMIN claims', async () => {
    expect(await validateLiveSession(claims)).toMatchObject({ role: 'usuário' });
  });
  it('rejects a session for a different company after privilege removal', async () => {
    await expect(validateLiveSession({ ...claims, company_id: 'company-b' })).rejects.toMatchObject({ statusCode: 401 });
  });
  it('allows a live super administrator to use another active company', async () => {
    mocks.user.mockResolvedValue({ ...liveUser, role: 'SUPER_ADMIN' });
    expect(await validateLiveSession({ ...claims, company_id: 'company-b' })).toMatchObject({ company_id: 'company-b' });
  });
  it('rejects deleted/inactive users and filters them in the database', async () => {
    mocks.user.mockResolvedValue(null);
    expect(await getServerSession()).toBeNull();
    expect(mocks.user).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-a', deleted_at: null, is_active: true } }));
  });
  it('rejects an inactive or deleted company', async () => {
    mocks.company.mockResolvedValue(null);
    expect(await getServerSession()).toBeNull();
    expect(mocks.company).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'company-a', deleted_at: null, is_active: true } }));
  });
  it.each([
    { ...claims, type: 'password_reset' },
    { ...claims, company_id: undefined },
    { ...claims, exp: undefined },
    { ...claims, iat: undefined },
    { ...claims, role: undefined },
  ])('rejects malformed or wrong-purpose JWTs before database access', async (invalid) => {
    await expect(validateLiveSession(invalid)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it('does not turn a password-reset token into a session via refresh', async () => {
    const signer = new FakeTokenSigner();
    const token = signer.sign({ ...claims, type: 'password_reset' });
    await expect(new RefreshTokenUseCase(signer, '8h').execute(token)).rejects.toMatchObject({ statusCode: 401 });
  });
  it('keeps the refresh grace period bounded', async () => {
    const signer = new FakeTokenSigner();
    const token = 'tok:' + JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) - 301 });
    signer.expired.add(token);
    await expect(new RefreshTokenUseCase(signer, '8h').execute(token)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('server permissions and ownership', () => {
  it('does not give unrestricted business access to ordinary users without a group', async () => {
    mocks.permissions.mockResolvedValue(null);
    const read = vi.fn();
    await expect(withPermission('leases', 'view', read)).rejects.toMatchObject({ statusCode: 403 });
    expect(read).not.toHaveBeenCalled();
  });
  it('does not allow an ordinary user to change permission groups', async () => {
    mocks.permissions.mockResolvedValue(null);
    const write = vi.fn();
    await expect(withPermission('user-groups', 'edit', write)).rejects.toMatchObject({ statusCode: 403 });
    expect(write).not.toHaveBeenCalled();
  });
  it('prevents execution when the group has no edit permission', async () => {
    const write = vi.fn();
    await expect(withPermission('leases', 'edit', write)).rejects.toMatchObject({ statusCode: 403 });
    expect(write).not.toHaveBeenCalled();
  });
  it('runs authorized operations in the session company context', async () => {
    mocks.permissions.mockResolvedValue(new Map([['leases', new Set(['edit'])]]));
    expect(await withPermission('leases', 'edit', async () => getCurrentCompanyId())).toBe('company-a');
    expect(getCurrentCompanyId()).toBeUndefined();
  });
  it('denies foreign references before executing a permitted write', async () => {
    mocks.permissions.mockResolvedValue(new Map([['leases', new Set(['edit'])]]));
    mocks.group.mockResolvedValue(null);
    const write = vi.fn();
    await expect(withPermissionInput('leases', 'edit', { owner_id: 'foreign-owner' }, write))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(write).not.toHaveBeenCalled();
    expect(mocks.group).toHaveBeenCalledWith({ where: { id: 'foreign-owner', company_id: 'company-a' }, select: { id: true } });
  });
  it('accepts references belonging to the active company', async () => {
    mocks.group.mockResolvedValue({ id: 'local-account' });
    await runWithTenant('company-a', () => assertTenantReferences({ financial_institution_id: 'local-account', owner_id: null }));
    expect(mocks.group).toHaveBeenCalledTimes(1);
  });
  it('refuses reference validation without tenant context', async () => {
    await expect(assertTenantReferences({ owner_id: 'x' })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('does not allow a tenant administrator to reset or edit a super administrator', async () => {
    mocks.user.mockResolvedValue({ role: 'SUPER_ADMIN' });
    await expect(assertCanManageUser({ ...claims, role: 'administrador' }, 'target')).rejects.toMatchObject({ statusCode: 403 });
  });
  it('does not allow ordinary users to create accounts', async () => {
    await expect(assertCanManageUser({ ...claims, role: 'usuário' })).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('direct calls to sensitive Server Actions', () => {
  const input = { name: 'New user', email: 'new@example.test', password: 'secret123', birth_date: '1990-01-01', gender: 'MALE' };
  beforeEach(() => mocks.permissions.mockResolvedValue(null));
  it('blocks creation of SUPER_ADMIN even if a tenant admin calls the action directly', async () => {
    mocks.user.mockResolvedValue({ ...liveUser, role: 'ADMIN' });
    expect(await createUserAction({ ...input, role: 'SUPER_ADMIN' })).toMatchObject({ ok: false, status: 403 });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it('blocks ordinary users from creating accounts', async () => {
    expect(await createUserAction(input)).toMatchObject({ ok: false, status: 403 });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it('allows tenant administrators to create ordinary accounts', async () => {
    mocks.user.mockResolvedValue({ ...liveUser, role: 'ADMIN' });
    mocks.createUser.mockResolvedValue({ id: 'new-user' });
    expect(await createUserAction(input)).toMatchObject({ ok: true });
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ created_by: 'user-a' }));
  });
  it('blocks a tenant administrator from changing a super administrator password', async () => {
    mocks.user.mockResolvedValueOnce({ ...liveUser, role: 'ADMIN' }).mockResolvedValueOnce({ role: 'SUPER_ADMIN' });
    expect(await updateUserAction('super-admin-id', { password: 'attacker-password' })).toMatchObject({ ok: false, status: 403 });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('protects full backups, which contain credentials and security roles', async () => {
    mocks.user.mockResolvedValue({ ...liveUser, role: 'ADMIN' });
    expect(await exportBackupAction()).toMatchObject({ ok: false, status: 403 });
    expect(await restoreBackupAction({ backupJson: '{}', confirmationName: 'a' })).toMatchObject({ ok: false, status: 403 });
    expect(mocks.backup).not.toHaveBeenCalled();
  });
  it('protects global company changes from tenant administrators', async () => {
    mocks.user.mockResolvedValue({ ...liveUser, role: 'ADMIN' });
    expect(await updateCompanyAction('other-company', { name: 'changed' })).toMatchObject({ ok: false, status: 403 });
    expect(mocks.companyWrite).not.toHaveBeenCalled();
  });
});
