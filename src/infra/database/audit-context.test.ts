import { describe, expect, it, vi } from 'vitest';
import { runWithAuditActor, withAuditContext } from './audit-context';

const actor = { id: 'user-a', company_id: 'company-a', name: 'Usuário', email: 'test@example.test' };
function setup() {
  const calls: string[] = [];
  const tx = { $executeRaw: vi.fn(async () => { calls.push('actor'); }),
    property: { update: vi.fn(async () => { calls.push('write'); return { id: 'property' }; }) } };
  const raw = { property: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      calls.push('begin');
      try { const result = await fn(tx); calls.push('commit'); return result; }
      catch (error) { calls.push('rollback'); throw error; }
    }) };
  return { calls, raw, tx, client: withAuditContext(raw) };
}
describe('audit transaction context', () => {
  it('sets actor before a standalone write and waits for commit', async () => {
    const { calls, client, tx } = setup();
    await runWithAuditActor(actor, () => client.property.update());
    expect(calls).toEqual(['begin', 'actor', 'write', 'commit']);
    expect(tx.$executeRaw.mock.calls[0]).toContain(JSON.stringify(actor));
  });
  it('keeps callback writes in the existing transaction', async () => {
    const { calls, client } = setup();
    await expect(runWithAuditActor(actor, () => client.$transaction(async tx => {
      await tx.property.update(); throw new Error('invalid operation');
    }))).rejects.toThrow('invalid operation');
    expect(calls).toEqual(['begin', 'actor', 'write', 'rollback']);
  });
  it('does not retain actor in later unauthenticated work', async () => {
    const { client, raw } = setup();
    await runWithAuditActor(actor, () => client.property.update());
    await client.property.update();
    expect(raw.property.update).toHaveBeenCalledTimes(1);
    expect(raw.$transaction).toHaveBeenCalledTimes(1);
  });
});
