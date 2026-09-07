import 'server-only';

import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import {
  daysBetween,
  overdueTotal,
  sortOverdueLeases,
  type LeaseNotificationChannel,
  type OverdueLease,
} from '@/core/entities/lease-overdue';
import { createDateLocal } from '@/shared/utils/date-utils';
import {
  addBusinessDays,
  fromDatabaseDate,
  holidaysForCity,
  nextBusinessDay,
} from '@/core/entities/credit-reconciliation';

/** Resumo usado pelo sininho e pelos cards da central de alertas. */
export interface LeaseOverdueSummary {
  items: OverdueLease[];
  total: number;
  critical: number;
  amount: number;
}

function todayInSaoPaulo(): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return createDateLocal(Number(value.year), Number(value.month), Number(value.day));
}

function contactDetails(contacts: Array<{
  email: string | null;
  cellphone: string | null;
  phone: string | null;
  channels: Array<{ kind: 'EMAIL' | 'CELLPHONE' | 'PHONE'; value: string }>;
}>): { email: string | null; phone: string | null } {
  for (const contact of contacts) {
    const email = contact.email?.trim()
      || contact.channels.find((channel) => channel.kind === 'EMAIL')?.value?.trim()
      || null;
    const phone = contact.cellphone?.trim()
      || contact.channels.find((channel) => channel.kind === 'CELLPHONE')?.value?.trim()
      || contact.phone?.trim()
      || contact.channels.find((channel) => channel.kind === 'PHONE')?.value?.trim()
      || null;
    if (email || phone) return { email, phone };
  }
  return { email: null, phone: null };
}

/**
 * Consulta interna já escopada por empresa. Cada lançamento mensal vencido
 * vira um alerta próprio; com isso duas competências atrasadas da mesma
 * locação não se escondem uma atrás da outra.
 */
export async function findOverdueLeasesForCompany(companyId: string): Promise<OverdueLease[]> {
  const today = todayInSaoPaulo();
  const rows = await prisma.transaction.findMany({
    where: {
      company_id: companyId,
      deleted_at: null,
      status: 'PENDING',
      effective_date: { lt: today },
      lease_id: { not: null },
      description: { startsWith: 'Aluguel', mode: 'insensitive' },
      lease: {
        is: {
          company_id: companyId,
          deleted_at: null,
          status: { not: 'CANCELED' },
        },
      },
    },
    select: {
      id: true,
      amount: true,
      effective_date: true,
      lease: {
        select: {
          id: true,
          contract_number: true,
          rent_due_day: true,
          overdue_status: true,
          property: {
            select: {
              title: true,
              addresses: {
                where: { deleted_at: null },
                take: 1,
                select: { address: { select: { city: true } } },
              },
            },
          },
          tenant: { select: { name: true } },
          agency: {
            select: {
              trade_name: true,
              legal_name: true,
              contacts: {
                where: { deleted_at: null },
                orderBy: { created_at: 'asc' },
                select: {
                  email: true,
                  cellphone: true,
                  phone: true,
                  channels: {
                    where: { deleted_at: null },
                    orderBy: { display_order: 'asc' },
                    select: { kind: true, value: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ effective_date: 'asc' }, { created_at: 'asc' }],
  });

  const leaseIds = [...new Set(rows.flatMap((row) => row.lease ? [row.lease.id] : []))];
  const notices = leaseIds.length === 0 ? [] : await prisma.leaseNotification.findMany({
    where: {
      company_id: companyId,
      lease_id: { in: leaseIds },
      deleted_at: null,
    },
    select: {
      lease_id: true,
      reference_month: true,
      reference_year: true,
      sent_at: true,
      channel: true,
    },
    orderBy: { sent_at: 'desc' },
  });

  const relevantYears = [...new Set([
    today.getUTCFullYear(),
    ...rows.map((row) => row.effective_date.getUTCFullYear()),
  ])];
  const registeredHolidays = relevantYears.length === 0 ? [] : await prisma.holiday.findMany({
    where: {
      company_id: companyId,
      deleted_at: null,
      date: {
        gte: createDateLocal(Math.min(...relevantYears), 1, 1),
        lte: createDateLocal(Math.max(...relevantYears), 12, 31),
      },
    },
    select: { date: true, scope: true, city: true },
  });

  const noticesByCompetence = new Map<string, {
    count: number;
    whatsappCount: number;
    latestAt: Date;
    latestChannel: LeaseNotificationChannel;
  }>();
  for (const notice of notices) {
    const key = `${notice.lease_id}:${notice.reference_year}:${notice.reference_month}`;
    const current = noticesByCompetence.get(key);
    if (current) {
      current.count += 1;
      if (notice.channel === 'WHATSAPP') current.whatsappCount += 1;
    }
    else noticesByCompetence.set(key, {
      count: 1,
      whatsappCount: notice.channel === 'WHATSAPP' ? 1 : 0,
      latestAt: notice.sent_at,
      latestChannel: notice.channel,
    });
  }

  const result: OverdueLease[] = [];
  for (const row of rows) {
    const lease = row.lease;
    if (!lease) continue;
    const agencyContact = contactDetails(lease.agency?.contacts ?? []);
    const city = lease.property.addresses[0]?.address.city ?? null;
    const holidays = holidaysForCity(registeredHolidays, city, relevantYears);
    const dueDate = fromDatabaseDate(row.effective_date);
    const expectedCreditDate = nextBusinessDay(dueDate, holidays);
    const automaticNotificationDate = addBusinessDays(expectedCreditDate, 1, holidays);
    const todayLocal = fromDatabaseDate(today);
    if (todayLocal.getTime() < automaticNotificationDate.getTime()) continue;
    const month = row.effective_date.getUTCMonth() + 1;
    const year = row.effective_date.getUTCFullYear();
    const notification = noticesByCompetence.get(`${lease.id}:${year}:${month}`);

    result.push({
      transaction_id: row.id,
      lease_id: lease.id,
      contract_number: lease.contract_number,
      property_title: lease.property.title,
      tenant_name: lease.tenant.name,
      agency_name: lease.agency?.trade_name || lease.agency?.legal_name || 'Imobiliária não informada',
      rent_due_day: lease.rent_due_day,
      due_date: row.effective_date,
      automatic_notification_date: automaticNotificationDate,
      days_overdue: daysBetween(row.effective_date, today),
      amount: Number(row.amount),
      reference_month: month,
      reference_year: year,
      overdue_status: lease.overdue_status,
      agency_email: agencyContact.email,
      agency_phone: agencyContact.phone,
      last_notified_at: notification?.latestAt ?? null,
      notification_count: notification?.count ?? 0,
      whatsapp_notification_count: notification?.whatsappCount ?? 0,
      last_notification_channel: notification?.latestChannel ?? null,
    });
  }

  return sortOverdueLeases(result);
}

export async function listOverdueLeasesData(): Promise<LeaseOverdueSummary> {
  return withPermission('leases', 'view', async (session) => {
    const items = await findOverdueLeasesForCompany(session.company_id);
    return {
      items,
      total: items.length,
      critical: items.filter((item) => item.days_overdue > 30).length,
      amount: overdueTotal(items),
    };
  });
}
