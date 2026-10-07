'use server';
import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { withReportingScope } from '@/infra/auth/reporting-scope';
import { expandReportingFilters } from '@/infra/repositories/reporting-catalog';
import { runAction } from '@/shared/actions/action-result';
import { reportParamsSchema } from '@/shared/validators/financial-report';
import { parseLocalDate } from '@/shared/utils/date-utils';
import { buildCenterSummary } from '@/core/entities/center-summary';
import { financialDateField } from '@/core/entities/financial-report';

export async function getCenterSummaryAction(raw: Record<string, unknown>) {
  return runAction(() => withPermission('financial-transactions', 'view', session => withReportingScope(session, raw, async () => {
    raw = await expandReportingFilters(raw);
    const query = reportParamsSchema.parse(raw);
    const fields = ['center_id','category_id','subcategory_id','financial_institution_id','card_id','supplier_id'];
    const filters: Record<string, unknown> = {};
    for (const field of fields) {
      const value = raw[field]; const ids = (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string' && !!v);
      if (ids.length) filters[field] = { in: ids };
    }
    const descriptions = (Array.isArray(raw.description) ? raw.description : [raw.description]).filter((v): v is string => typeof v === 'string' && !!v);
    const dateField = financialDateField(query.regime);
    const totals = await prisma.transaction.groupBy({ by: ['center_id','category_id'],
      where: { deleted_at: null, NOT: { is_transfer: true }, status: query.status, ...filters,
        category: { type: query.type ?? { in: ['INCOME','EXPENSE'] } },
        [dateField]: { gte: parseLocalDate(query.startDate), lte: parseLocalDate(query.endDate) },
        ...(descriptions.length ? { OR: descriptions.map(description => ({ description: { contains: description, mode: 'insensitive' as const } })) } : {}),
      }, _sum: { amount: true } });
    const centerIds = [...new Set(totals.flatMap(total => total.center_id ? [total.center_id] : []))];
    const [centers, categories, properties] = await Promise.all([
      prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true, company_id: true, type: true } }),
      prisma.category.findMany({ where: { id: { in: [...new Set(totals.map(total => total.category_id))] } }, select: { id: true, type: true } }),
      prisma.property.findMany({ where: { deleted_at: null, OR: [{ center_id: { in: centerIds } }, { debit_center_id: { in: centerIds } }] },
        select: { id: true, title: true, company_id: true, center_id: true, debit_center_id: true } }),
    ]);
    return buildCenterSummary(totals.map(t => ({ ...t, amount: Number(t._sum.amount ?? 0) })), centers, categories, properties);
  })));
}
