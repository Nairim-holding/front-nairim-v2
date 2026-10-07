import { beforeEach, expect, it, vi } from 'vitest';
import { runWithAuditActor } from './audit-context';
import { writeTransferAuditEvent } from './audit-events';
const create = vi.fn().mockResolvedValue({});
const client = { auditLogOutbox: { create } };
const actor = { id: 'user', name: 'Usuário', email: 'user@example.test', company_id: 'a', ip: '1'.repeat(60) };
const event = { action: 'EXPORT' as const, companyId: 'a', tableName: 'Repair', description: 'Exportação de reparos', format: 'JSON' as const, recordCount: 0 };
beforeEach(() => vi.clearAllMocks());
it('uses the authenticated actor, retains zero counts and truncates the IP', async () => {
  await runWithAuditActor(actor, () => writeTransferAuditEvent(client, event));
  expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ company_id: 'a', user_id: 'user', user_name: 'Usuário', user_email: actor.email,
    ip: '1'.repeat(45), action: 'EXPORT', table_name: 'Repair', new_values: { description: event.description, format: 'JSON', record_count: 0 } }) });
});
it('fails closed without an actor or with a different tenant', async () => {
  await expect(writeTransferAuditEvent(client, event)).rejects.toThrow('Contexto de auditoria');
  await expect(runWithAuditActor({ ...actor, company_id: 'b' }, () => writeTransferAuditEvent(client, event))).rejects.toThrow('Contexto de auditoria');
  expect(create).not.toHaveBeenCalled();
});
it('does not copy arbitrary contents, credentials or source authors from imported input', async () => {
  const input = { ...event, action: 'IMPORT' as const, created: 1, updated: 0, counts: { Repair: 1 }, password: 'NEVER_LOG', data: [{ password: 'NEVER_LOG' }], user_id: 'spoofed' };
  await runWithAuditActor(actor, () => writeTransferAuditEvent(client, input));
  expect(create.mock.calls[0][0].data.new_values).toEqual({ description: event.description, format: 'JSON', record_count: 0, record_counts: { Repair: 1 }, created_count: 1, updated_count: 0 });
  expect(JSON.stringify(create.mock.calls)).not.toContain('NEVER_LOG');
  expect(JSON.stringify(create.mock.calls)).not.toContain('spoofed');
});
it('propagates outbox failures so the owning transaction can roll back', async () => {
  create.mockRejectedValueOnce(new Error('outbox unavailable'));
  await expect(runWithAuditActor(actor, () => writeTransferAuditEvent(client, event))).rejects.toThrow('outbox unavailable');
});
