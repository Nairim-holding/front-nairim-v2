import 'server-only';

import prisma from '@/infra/database/prisma';
import { sendEvolutionWhatsApp } from '@/infra/services/evolution-whatsapp-client';
import { ValidationError } from '@/core/errors/domain-errors';
import { buildNotificationMessage, type OverdueLease } from '@/core/entities/lease-overdue';

/** Envia primeiro; somente depois do aceite da Evolution grava o histórico. */
export async function deliverOverdueWhatsApp(
  companyId: string,
  overdue: OverdueLease,
  sentById: string | null,
): Promise<{ recorded_at: Date; provider_message_id: string | null }> {
  if (!overdue.agency_phone) {
    throw new ValidationError('A imobiliária não possui celular ou telefone cadastrado.');
  }

  const message = buildNotificationMessage({ ...overdue, due_date: new Date(overdue.due_date) });
  const delivery = await sendEvolutionWhatsApp(overdue.agency_phone, message);
  const recordedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.leaseNotification.create({
      data: {
        company_id: companyId,
        lease_id: overdue.lease_id,
        channel: 'WHATSAPP',
        recipient: overdue.agency_phone,
        message,
        reference_month: overdue.reference_month,
        reference_year: overdue.reference_year,
        days_overdue: overdue.days_overdue,
        sent_at: recordedAt,
        sent_by_id: sentById,
      },
    });
    await tx.lease.updateMany({
      where: { id: overdue.lease_id, company_id: companyId, deleted_at: null },
      data: { overdue_status: 'NOTIFIED' },
    });
  });

  return { recorded_at: recordedAt, provider_message_id: delivery.messageId };
}
