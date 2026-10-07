import type { Prisma } from '@/generated/prisma/client';
import { getAuditActor } from './audit-context';
import { ForbiddenError } from '@/core/errors/domain-errors';

interface TransferAuditEvent {
  action: 'EXPORT' | 'IMPORT';
  tableName: string;
  companyId: string;
  description: string;
  format: 'JSON' | 'XLSX' | 'PDF';
  recordCount: number;
  counts?: Record<string, number>;
  created?: number;
  updated?: number;
}

/** Only operation metadata goes into the log; never the file's contents. */
export async function writeTransferAuditEvent(
  client: { auditLogOutbox: { create(args: { data: Prisma.AuditLogOutboxUncheckedCreateInput }): PromiseLike<unknown> } },
  event: TransferAuditEvent,
): Promise<void> {
  const actor = getAuditActor();
  if (!actor || actor.company_id !== event.companyId) {
    throw new ForbiddenError('Contexto de auditoria não identificado para esta empresa.');
  }
  await client.auditLogOutbox.create({ data: {
    company_id: actor.company_id,
    user_id: actor.id,
    user_name: actor.name,
    user_email: actor.email,
    ip: actor.ip?.slice(0, 45),
    action: event.action,
    table_name: event.tableName,
    new_values: {
      description: event.description,
      format: event.format,
      record_count: event.recordCount,
      ...(event.counts ? { record_counts: event.counts } : {}),
      ...(event.created !== undefined ? { created_count: event.created } : {}),
      ...(event.updated !== undefined ? { updated_count: event.updated } : {}),
    },
  } });
}
