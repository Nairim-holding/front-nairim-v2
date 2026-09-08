import { describe, expect, it, vi } from 'vitest';

interface TestArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
}
type Handler = (input: { model: string; args: TestArgs; query: (args: TestArgs) => Promise<TestArgs> }) => Promise<TestArgs>;
const state = vi.hoisted(() => ({ handlers: {} as Record<string, Handler> }));
vi.mock('@/infra/config/env', () => ({ env: { DATABASE_URL: 'unused', NODE_ENV: 'test' } }));
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: class {} }));
vi.mock('@/generated/prisma/client', () => ({ PrismaClient: class {
  $extends(config: { query: { $allModels: Record<string, Handler> } }) { state.handlers = config.query.$allModels; return {}; }
} }));

import { injectCreate, injectRead, injectUpdate } from './prisma';
import { runWithTenant } from './tenant-context';

describe('Prisma tenant isolation', () => {
  it('does not accept company_id overrides in filters', () => {
    const args = runWithTenant('a', () => injectRead('Property', { where: { id: 'target', company_id: 'b', OR: [{ company_id: 'b' }] } }));
    expect(args.where).toEqual({ id: 'target', company_id: 'a', OR: [{ company_id: 'b' }] });
  });
  it('does not change deliberate global queries outside tenant context', () => {
    const args = { where: { id: 'login-user' } };
    expect(injectRead('User', args)).toBe(args);
  });
  it('forces ownership on scalar creates', () => {
    expect(runWithTenant('a', () => injectCreate('Property', { data: { company_id: 'b', name: 'safe' } })))
      .toEqual({ data: { company_id: 'a', name: 'safe' } });
  });
  it('forces ownership on relation creates without mixing checked/unchecked inputs', () => {
    const args = runWithTenant('a', () => injectCreate('Property', { data: { company_id: 'b', company: { connect: { id: 'b' } }, owner: { connect: { id: 'o' } } } }));
    expect(args.data).toEqual({ company: { connect: { id: 'a' } }, owner: { connect: { id: 'o' } } });
  });
  it('removes attempts to transfer ownership on update', () => {
    expect(runWithTenant('a', () => injectUpdate('User', { where: { id: 'x' }, data: { company_id: { set: 'b' }, company: { connect: { id: 'b' } }, name: 'new' } })))
      .toEqual({ where: { id: 'x', company_id: 'a' }, data: { name: 'new' } });
  });
  it.each(['findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany', 'upsert'])
   ('scopes %s including writes and unique lookups', async (operation) => {
      const query = vi.fn(async (args) => args);
      const result = await runWithTenant('a', () => state.handlers[operation]({ model: 'UserDashboardLayout', args: { where: { id: 'foreign', company_id: 'b' }, data: {}, create: {}, update: {} }, query }));
      expect(result.where).toEqual({ id: 'foreign', company_id: 'a' });
      if (operation === 'upsert') expect(result.create?.company_id).toBe('a');
    });
  it.each(['createMany', 'createManyAndReturn'])('forces company on every %s row and single-object input', async (operation) => {
    for (const data of [[{ company_id: 'b' }, {}], { company_id: 'b' }]) {
      const query = vi.fn(async (args) => args);
      const result = await runWithTenant('a', () => state.handlers[operation]({ model: 'Property', args: { data }, query }));
      expect(Array.isArray(result.data) && result.data.every((row) => row.company_id === 'a')).toBe(true);
    }
  });
});
