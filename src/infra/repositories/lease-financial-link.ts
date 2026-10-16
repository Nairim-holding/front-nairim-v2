import { matchReportLease, normalizeReportText } from '@/core/entities/lease-report-matching';
import { isLeaseReceivableDue } from '@/core/entities/lease-overdue';
import { ValidationError } from '@/core/errors/domain-errors';
import { leaseMonthlyTransactionKind } from '@/core/entities/lease-transaction-kind';

interface LeaseLinkSource {
  id?: string;
  description: string;
  event_date: Date;
  effective_date: Date;
  status: string;
  lease_id?: string | null;
  is_cancellation_charge?: boolean;
  installment_number?: number | null;
  category_id?: string;
  subcategory_id?: string | null;
  category?: { type: string } | null;
  subcategory?: { name: string } | null;
}

type LeaseLinkClient = Pick<typeof import('@/infra/database/prisma').default, 'lease' | 'transaction' | 'category' | 'subcategory'>;

export async function assertNoGeneratedLeaseOverlap(client: LeaseLinkClient, leaseId: string, companyId: string, source: LeaseLinkSource): Promise<void> {
  if ((source.lease_id && source.installment_number != null) || source.is_cancellation_charge) return;
  const category = source.category ?? (source.category_id
    ? await client.category.findFirst({ where: { id: source.category_id, company_id: companyId }, select: { type: true } }) : null);
  const subcategory = source.subcategory ?? (source.subcategory_id
    ? await client.subcategory.findFirst({ where: { id: source.subcategory_id, company_id: companyId }, select: { name: true } }) : null);
  const kind = leaseMonthlyTransactionKind({ ...source, category, subcategory });
  if (!kind) return;
  const year = source.event_date.getUTCFullYear();
  const month = source.event_date.getUTCMonth();
  const generated = await client.transaction.findMany({
    where: {
      lease_id: leaseId, company_id: companyId, deleted_at: null, canceled_at: null,
      installment_number: { not: null }, ...(source.id ? { id: { not: source.id } } : {}),
      event_date: { gte: new Date(Date.UTC(year, month, 1)), lt: new Date(Date.UTC(year, month + 1, 1)) },
    },
    select: { description: true, category: { select: { type: true } }, subcategory: { select: { name: true } } },
  });
  if (generated.some((item) => leaseMonthlyTransactionKind(item) === kind)) {
    throw new ValidationError('Já existe uma parcela desta competência no contrato. Abra o Histórico Financeiro e edite ou quite o lançamento existente para evitar duplicidade.');
  }
}

/** Keep saves made from Financeiro attached to the same contract as reports.
 * Ambiguous legacy descriptions remain available for manual review. */
export async function resolveFinancialLeaseLink(
  client: LeaseLinkClient,
  companyId: string,
  source: LeaseLinkSource,
  expectedLeaseId?: string,
): Promise<string | null> {
  const text = normalizeReportText(source.description);
  const linkedId = source.lease_id ?? expectedLeaseId;
  if (!linkedId && !source.subcategory_id && !/\b(?:aluguel|alugueis|comissao|iptu|condominio|contrato)\b/.test(text)) return null;
  const leases = await client.lease.findMany({
    where: { company_id: companyId, deleted_at: null },
    select: { id: true, contract_number: true, start_date: true, end_date: true, canceled_at: true, property: { select: { title: true } } },
  });
  const match = matchReportLease(source.description, source.event_date, leases);
  if (linkedId && /\bcontrato\s+/.test(text) && match?.id !== linkedId) {
    throw new ValidationError('A descrição deve manter o contrato vinculado ao lançamento.');
  }
  const lease = linkedId ? leases.find((item) => item.id === linkedId) : match;
  if (linkedId && !lease) throw new ValidationError('O contrato vinculado ao lançamento não está disponível.');
  if (!lease) return null;
  if (source.status === 'PENDING' && !source.is_cancellation_charge && !isLeaseReceivableDue(source.effective_date, lease.canceled_at)) {
    throw new ValidationError('Não é possível manter uma parcela pendente a partir do cancelamento do contrato. Verifique o Histórico Financeiro da locação.');
  }
  await assertNoGeneratedLeaseOverlap(client, lease.id, companyId, source);
  return lease.id;
}
