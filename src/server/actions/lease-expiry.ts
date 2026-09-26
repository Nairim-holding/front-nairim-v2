'use server';

import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { runAction } from '@/shared/actions/action-result';
import { occupancyDate } from '@/shared/utils/property-occupancy';
import { canDismissExpiry, expiryDays, type LeaseExpiryAlert } from '@/core/entities/lease-expiry';
import { ValidationError } from '@/core/errors/domain-errors';
import { z } from 'zod';

async function findAlerts(companyId: string, userId: string) {
  const today = occupancyDate();
  const until = new Date(today);
  until.setUTCDate(until.getUTCDate() + 30);
  return prisma.lease.findMany({
    where: { company_id: companyId, deleted_at: null, status: { not: 'CANCELED' },
      end_date: { gte: today, lte: until }, property: { deleted_at: null },
    },
    select: { id: true, end_date: true, property: { select: { title: true } }, tenant: { select: { name: true } },
      expiry_reminders: { where: { user_id: userId, company_id: companyId } },
    },
    orderBy: [{ end_date: 'asc' }, { id: 'asc' }],
  });
}

export async function getLeaseExpiryAlertsAction(displayedIds: string[] = []) {
  return runAction(() => withPermission('leases', 'view', async session => {
    const displayed = new Set(z.array(z.string().min(1)).max(1000).parse(displayedIds));
    const today = occupancyDate().toISOString().slice(0, 10);
    const rows = await findAlerts(session.company_id, session.id);
    const alerts: LeaseExpiryAlert[] = [];
    for (const lease of rows) {
      let reminder = lease.expiry_reminders.find(row => row.end_date.getTime() === lease.end_date.getTime());
      if (reminder?.dismissed || reminder?.acknowledged_on === today) continue;
      if (displayed.has(lease.id)) {
        reminder = await prisma.leaseExpiryReminder.upsert({
          where: { user_id_lease_id_end_date: { user_id: session.id, lease_id: lease.id, end_date: lease.end_date } },
          create: { company_id: session.company_id, user_id: session.id, lease_id: lease.id, end_date: lease.end_date },
          update: {},
        });
        // Atomic predicate prevents duplicate displays from multiple tabs/polls.
        await prisma.leaseExpiryReminder.updateMany({
          where: { id: reminder.id, company_id: session.company_id, user_id: session.id, NOT: { shown_days: { has: today } } },
          data: { shown_days: { push: today } },
        });
        reminder = await prisma.leaseExpiryReminder.findFirstOrThrow({ where: { id: reminder.id, user_id: session.id } });
        if (reminder.dismissed || reminder.acknowledged_on === today) continue;
      }
      alerts.push({ leaseId: lease.id, propertyTitle: lease.property.title, tenantName: lease.tenant.name,
        endDate: lease.end_date.toISOString().slice(0, 10), daysRemaining: expiryDays(lease.end_date),
        canDismiss: canDismissExpiry(reminder?.shown_days ?? [], today),
      });
    }
    return alerts;
  }));
}

export async function acknowledgeLeaseExpiryAction(leaseId: string, endDate: string, dismiss = false) {
  return runAction(() => withPermission('leases', 'view', async session => {
    const input = z.object({ leaseId: z.string().min(1), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dismiss: z.boolean() }).parse({ leaseId, endDate, dismiss });
    const today = occupancyDate().toISOString().slice(0, 10);
    const leases = await findAlerts(session.company_id, session.id);
    const lease = leases.find(row => row.id === input.leaseId && row.end_date.toISOString().slice(0, 10) === input.endDate);
    if (!lease) throw new ValidationError('Este vencimento não está mais pendente. Atualize os alertas.');
    const reminder = lease.expiry_reminders.find(row => row.end_date.getTime() === lease.end_date.getTime());
    if (!reminder || !reminder.shown_days.includes(today)) throw new ValidationError('Abra o alerta antes de confirmar.');
    if (dismiss && !canDismissExpiry(reminder.shown_days, today)) throw new ValidationError('O alerta deve ser exibido em três dias consecutivos antes de ser dispensado.');
    await prisma.leaseExpiryReminder.update({ where: { id: reminder.id, company_id: session.company_id, user_id: session.id },
      data: dismiss ? { dismissed: true } : { acknowledged_on: today },
    });
    return null;
  }));
}
