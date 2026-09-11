'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { logsCollection, logsDatabase } from '@/infra/database/mongodb';
import prisma from '@/infra/database/prisma';
import { assertAdmin, withPermission } from '@/infra/auth/session';
import { runAction } from '@/shared/actions/action-result';
import { ValidationError } from '@/core/errors/domain-errors';
import { buildLogSelection, logSelectionSchema, type LogSelection } from '@/shared/validators/log-management';

interface PurgePreview {
  _id: string;
  company_id: string;
  user_id: string;
  selection: LogSelection;
  cutoff: Date;
  count: number;
  expires_at: Date;
}

export async function logStorageStatusAction() {
  return runAction(() => withPermission('audit-logs', 'view', async session => {
    assertAdmin(session);
    const logs = await logsCollection();
    const [stored, pending] = await Promise.all([
      logs.countDocuments({ company_id: session.company_id }),
      prisma.auditLogOutbox.count({ where: { company_id: session.company_id } }),
    ]);
    return { stored, pending };
  }));
}

export async function previewLogPurgeAction(input: unknown) {
  return runAction(() => withPermission('audit-logs', 'delete', async session => {
    assertAdmin(session);
    const selection = logSelectionSchema.parse(input);
    const cutoff = new Date();
    const count = await (await logsCollection()).countDocuments(buildLogSelection(session.company_id, selection, cutoff));
    const previews = (await logsDatabase()).collection<PurgePreview>('purge_previews');
    await previews.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    const token = randomUUID();
    await previews.insertOne({ _id: token, company_id: session.company_id, user_id: session.id,
      selection, cutoff, count, expires_at: new Date(cutoff.getTime() + 10 * 60000) });
    return { token, count };
  }));
}

export async function purgeLogsAction(input: unknown) {
  return runAction(() => withPermission('audit-logs', 'delete', async session => {
    assertAdmin(session);
    const { token } = z.object({ token: z.string().uuid(), confirmation: z.literal('EXCLUIR LOGS') }).parse(input);
    const previews = (await logsDatabase()).collection<PurgePreview>('purge_previews');
    // Same lock as the delivery worker: acknowledged documents cannot be replayed after a purge.
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(739182406)`;
      const pending = await tx.auditLogOutbox.count({ where: { company_id: session.company_id } });
      if (pending) throw new ValidationError('Há logs aguardando transferência. Aguarde a sincronização e tente novamente.');
      const preview = await previews.findOne({ _id: token, company_id: session.company_id, user_id: session.id, expires_at: { $gt: new Date() } });
      if (!preview) throw new ValidationError('Confirmação expirada ou já utilizada. Confira a quantidade novamente.');
      const logs = await logsCollection();
      const query = buildLogSelection(session.company_id, preview.selection, preview.cutoff);
      if (await logs.countDocuments(query) !== preview.count) throw new ValidationError('A seleção mudou. Confira a quantidade novamente.');
      const result = await logs.deleteMany(query, { writeConcern: { w: 'majority', j: true } });
      await previews.deleteOne({ _id: token });
      return { deleted: result.deletedCount };
    }, { timeout: 60000, maxWait: 10000 });
  }));
}
