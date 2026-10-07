import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: null as Record<string, unknown> | null, scopes: [] as (string | undefined)[] }));
vi.mock('@/infra/database/prisma', async () => {
  const { getCurrentCompanyId } = await import('@/infra/database/tenant-context');
  return { default: {
    user: { findFirst: () => ({
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        const scope = getCurrentCompanyId();
        state.scopes.push(scope);
        return Promise.resolve(scope ? null : state.user).then(resolve, reject);
      },
    }) },
    company: { findFirst: vi.fn().mockResolvedValue({ id: 'destination' }) },
  } };
});
import { getCurrentCompanyId, runWithTenant } from '@/infra/database/tenant-context';
import { validateLiveSession } from './live-session';
import { getCompanyAccessUser } from './company-access';
import { PrismaUserGroupPermissionsRepository } from '@/infra/repositories/prisma-user-group-permissions-repository';
const claims = { id: 'actor', name: 'Operador', email: 'test@example.com', company_id: 'destination', role: 'ADMIN', iat: 100, exp: 200 };
describe('consultas de autoridade com Prisma lazy depois de trocar de empresa', () => {
  beforeEach(() => {
    state.scopes = [];
    state.user = { id: 'actor', name: 'Operador', email: 'test@example.com', company_id: 'origin', role: 'ADMIN', all_companies_access: true, allowed_company_ids: [], has_time_restriction: false, access_schedules: [], user_group_id: null, group: null };
  });
  it('revalida a sessao dentro de uma verificacao aninhada na empresa destino', async () => {
    await runWithTenant('destination', async () => {
      expect((await validateLiveSession(claims)).company_id).toBe('destination');
      expect(getCurrentCompanyId()).toBe('destination');
    });
    expect(state.scopes).toEqual([undefined]);
  });
  it('consulta a autoridade para listar ou trocar de empresa sem perder o usuario', async () => {
    await runWithTenant('destination', async () => {
      expect((await getCompanyAccessUser('actor')).company_id).toBe('origin');
      expect(getCurrentCompanyId()).toBe('destination');
    });
    expect(state.scopes).toEqual([undefined]);
  });
  it('resolve permissoes do usuario de origem com acesso autorizado ao destino', async () => {
    await runWithTenant('destination', async () => {
      expect(await new PrismaUserGroupPermissionsRepository().resolveForUser('actor')).toBeNull();
      expect(getCurrentCompanyId()).toBe('destination');
    });
    expect(state.scopes).toEqual([undefined]);
  });
  it('continua negando uma sessao sem acesso a empresa destino', async () => {
    state.user!.all_companies_access = false;
    await expect(runWithTenant('destination', () => validateLiveSession(claims))).rejects.toThrow('Sessão revogada');
  });
  it('continua negando permissoes na empresa destino quando o acesso foi revogado', async () => {
    state.user!.all_companies_access = false;
    const permissions = await runWithTenant('destination', () => new PrismaUserGroupPermissionsRepository().resolveForUser('actor'));
    expect(permissions?.size).toBe(0);
  });
});
