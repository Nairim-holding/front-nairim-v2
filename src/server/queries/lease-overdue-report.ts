import 'server-only';
import { z } from 'zod';
import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { withReportingScope } from '@/infra/auth/reporting-scope';
import { classifyLeaseReportTransaction } from '@/infra/repositories/prisma-lease-reports-repository';
import { matchReportLease } from '@/core/entities/lease-report-matching';
import { daysBetween } from '@/core/entities/lease-overdue';

export async function getOverdueLeaseReportData(raw: Record<string, unknown>) {
  const { asOf } = z.object({ asOf: z.string().date('Informe uma data limite válida') }).parse(raw);
  const cutoff = new Date(`${asOf}T00:00:00Z`);
  return withPermission('lease-reports', 'view', session => withReportingScope(session, raw, async () => {
    const [transactions, leases] = await Promise.all([
      prisma.transaction.findMany({ where: { deleted_at: null, status: 'PENDING', is_transfer: false,
        effective_date: { lt: cutoff }, category: { type: 'INCOME' } },
        select: { id: true, company_id: true, lease_id: true, amount: true, event_date: true, effective_date: true,
          description: true, is_cancellation_charge: true, category: { select: { type: true } }, subcategory: { select: { name: true } } },
        orderBy: [{ effective_date: 'asc' }, { id: 'asc' }] }),
      prisma.lease.findMany({ where: { deleted_at: null }, select: { id: true, company_id: true, contract_number: true, start_date: true, end_date: true, canceled_at: true,
        agency: { select: { trade_name: true } }, property: { select: { title: true, agency: { select: { trade_name: true } } } }, tenant: { select: { name: true } } } }),
    ]);
    const byId = new Map(leases.map(lease => [lease.id, lease]));
    const byCompany = new Map<string, typeof leases>();
    for (const lease of leases) { const rows = byCompany.get(lease.company_id) ?? []; rows.push(lease); byCompany.set(lease.company_id, rows); }
    const rows = []; const unmatched = [];
    for (const tx of transactions) {
      if (classifyLeaseReportTransaction(tx) !== 'rent') continue;
      const lease = tx.lease_id ? byId.get(tx.lease_id) : matchReportLease(tx.description, tx.event_date, byCompany.get(tx.company_id) ?? []);
      if (!lease || lease.company_id !== tx.company_id) { unmatched.push({ id: tx.id, description: tx.description }); continue; }
      rows.push({ id: tx.id, contract: lease.contract_number, agency: lease.agency?.trade_name ?? lease.property.agency?.trade_name ?? '—',
        property: lease.property.title, tenant: lease.tenant.name, reference: `${String(tx.event_date.getUTCMonth() + 1).padStart(2, '0')}/${tx.event_date.getUTCFullYear()}`,
        dueDate: tx.effective_date.toISOString().slice(0, 10), daysOverdue: daysBetween(tx.effective_date, cutoff), amount: Number(tx.amount), description: tx.description });
    }
    return { asOf, rows, unmatched, total: Math.round(rows.reduce((sum,row) => sum + row.amount, 0) * 100) / 100 };
  }));
}
