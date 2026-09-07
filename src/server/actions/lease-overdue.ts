'use server';

import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';
import { type LeaseOverdueStatus } from '@/core/entities/lease-overdue';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import {
  findOverdueLeasesForCompany,
  listOverdueLeasesData,
  type LeaseOverdueSummary,
} from '@/server/queries/lease-overdue';
import { deliverOverdueWhatsApp } from '@/server/services/lease-overdue-whatsapp';

export async function getOverdueLeaseAlertsAction(): Promise<ActionResult<LeaseOverdueSummary>> {
  return runAction(() => listOverdueLeasesData());
}

export async function updateLeaseOverdueStatusAction(
  transactionId: string,
  status: LeaseOverdueStatus | null,
): Promise<ActionResult<null>> {
  return runAction(() => withPermission('leases', 'edit', async (session) => {
    if (status !== null && status !== 'NOTIFIED' && status !== 'NEGOTIATING') {
      throw new ValidationError('Situação do alerta inválida.');
    }
    const overdue = (await findOverdueLeasesForCompany(session.company_id))
      .find((item) => item.transaction_id === transactionId);
    if (!overdue) throw new NotFoundError('A locação não está mais em atraso.');

    const updated = await prisma.lease.updateMany({
      where: { id: overdue.lease_id, company_id: session.company_id, deleted_at: null },
      data: { overdue_status: status },
    });
    if (updated.count === 0) throw new NotFoundError('Locação não encontrada.');
    return null;
  }));
}

export async function sendLeaseOverdueWhatsAppAction(
  transactionId: string,
): Promise<ActionResult<{ recorded_at: Date; provider_message_id: string | null }>> {
  return runAction(() => withPermission('leases', 'edit', async (session) => {
    const overdue = (await findOverdueLeasesForCompany(session.company_id))
      .find((item) => item.transaction_id === transactionId);
    if (!overdue) throw new NotFoundError('A locação não está mais em atraso.');
    return deliverOverdueWhatsApp(session.company_id, overdue, session.id);
  }));
}
