import prisma from '@/infra/database/prisma';
import type { LeaseCreditReconciliationRepository } from '@/core/repositories/lease-credit-reconciliation-repository';
import {
  amountMatches,
  fromDatabaseDate,
  holidaysForCity,
  computeLeaseNetAmount,
  nextBusinessDay,
  round2,
  sortCandidates,
  type CompleteCreditReconciliationInput,
  type CreditCandidate,
  type CreditReconciliationSearchInput,
} from '@/core/entities/credit-reconciliation';
import { WITHHOLDING_TOTAL_RATE } from '@/core/entities/lease-report';
import { createDateLocal } from '@/shared/utils/date-utils';

type Kind = 'rent' | 'commission' | 'iptu' | 'other';

const COMBINING_MARKS = /[̀-ͯ]/g;

function normalize(value: string | null | undefined): string {
  return String(value ?? '').normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

function kindOf(description: string): Kind {
  const first = normalize(description).split(/\s+/)[0];
  if (first === 'aluguel') return 'rent';
  if (first === 'comissao') return 'commission';
  if (first === 'restituicao') return 'iptu';
  return 'other';
}

function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function safeDueDate(year: number, monthIndex: number, dueDay: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0, 12).getDate();
  return new Date(year, monthIndex, Math.min(Math.max(dueDay, 1), lastDay), 12);
}

function isWithinLease(date: Date, start: Date, end: Date): boolean {
  const key = dateKey(date);
  const startKey = dateKey(fromDatabaseDate(start));
  const endKey = dateKey(fromDatabaseDate(end));
  return key >= startKey && key <= endKey;
}

export class PrismaLeaseCreditReconciliationRepository implements LeaseCreditReconciliationRepository {
  async search(companyId: string, input: CreditReconciliationSearchInput): Promise<CreditCandidate[]> {
    const creditDate = parseCalendarDate(input.credit_date);
    const rangeStart = new Date(creditDate);
    rangeStart.setDate(rangeStart.getDate() - 35);

    const [leases, registeredHolidays] = await Promise.all([
      prisma.lease.findMany({
        where: {
          company_id: companyId,
          deleted_at: null,
          status: { not: 'CANCELED' },
          agency_id: { in: input.agency_ids },
          financial_institution_id: input.financial_institution_id,
          start_date: { lte: createDateLocal(creditDate.getFullYear(), creditDate.getMonth() + 1, creditDate.getDate()) },
        },
        select: {
          id: true,
          start_date: true,
          end_date: true,
          rent_amount: true,
          commission_amount: true,
          agency_commission: true,
          rent_due_day: true,
          tax_due_day: true,
          condo_due_day: true,
          agency: { select: { trade_name: true } },
          tenant: { select: { name: true } },
          property: {
            select: {
              title: true,
              income_tax_withholding: true,
              addresses: {
                where: { deleted_at: null },
                take: 1,
                select: { address: { select: { city: true } } },
              },
            },
          },
        },
      }),
      prisma.holiday.findMany({
        where: {
          company_id: companyId,
          deleted_at: null,
          date: {
            gte: createDateLocal(rangeStart.getFullYear(), rangeStart.getMonth() + 1, rangeStart.getDate()),
            lte: createDateLocal(creditDate.getFullYear(), creditDate.getMonth() + 1, creditDate.getDate()),
          },
        },
        select: { date: true, scope: true, city: true },
      }),
    ]);

    const matchedLeases = leases.flatMap((lease) => {
      const city = lease.property.addresses[0]?.address.city ?? null;
      const years = [...new Set([creditDate.getFullYear(), rangeStart.getFullYear()])];
      const holidays = holidaysForCity(registeredHolidays, city, years);
      const possibleDueDates = [
        safeDueDate(creditDate.getFullYear(), creditDate.getMonth(), lease.rent_due_day),
        safeDueDate(new Date(creditDate.getFullYear(), creditDate.getMonth() - 1, 1).getFullYear(), new Date(creditDate.getFullYear(), creditDate.getMonth() - 1, 1).getMonth(), lease.rent_due_day),
      ];
      const dueDate = possibleDueDates.find(
        (date) => isWithinLease(date, lease.start_date, lease.end_date)
          && dateKey(nextBusinessDay(date, holidays)) === dateKey(creditDate),
      );
      return dueDate ? [{ lease, dueDate, holidays }] : [];
    });

    if (matchedLeases.length === 0) return [];

    const pending = await prisma.transaction.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
        status: 'PENDING',
        is_cancellation_charge: false,
        financial_institution_id: input.financial_institution_id,
        lease_id: { in: matchedLeases.map(({ lease }) => lease.id) },
        effective_date: {
          gte: createDateLocal(rangeStart.getFullYear(), rangeStart.getMonth() + 1, rangeStart.getDate()),
          lte: createDateLocal(creditDate.getFullYear(), creditDate.getMonth() + 1, creditDate.getDate()),
        },
      },
      select: { id: true, lease_id: true, amount: true, description: true, effective_date: true },
    });

    const candidates: CreditCandidate[] = matchedLeases.flatMap(({ lease, dueDate, holidays }) => {
      const transactions = pending.filter((transaction) => {
        if (transaction.lease_id !== lease.id) return false;
        const scheduledDate = fromDatabaseDate(transaction.effective_date);
        return dateKey(nextBusinessDay(scheduledDate, holidays)) === dateKey(creditDate)
          && kindOf(transaction.description) !== 'other';
      });
      const rentTransactions = transactions.filter((transaction) => kindOf(transaction.description) === 'rent');
      if (rentTransactions.length === 0) return [];

      const sum = (kind: Kind) => round2(transactions
        .filter((transaction) => kindOf(transaction.description) === kind)
        .reduce((total, transaction) => total + Number(transaction.amount), 0));
      const gross = sum('rent') || Number(lease.rent_amount);
      const iptu = sum('iptu');
      const commissionFromTransactions = sum('commission');
      const configuredCommission = Number(lease.commission_amount ?? 0)
        || round2(gross * Number(lease.agency_commission ?? 0) / 100);
      const commission = commissionFromTransactions || configuredCommission;
      const withholding = lease.property.income_tax_withholding ? round2(gross * WITHHOLDING_TOTAL_RATE) : 0;
      const net = computeLeaseNetAmount({
        gross_amount: gross,
        property_tax_refund: iptu,
        income_tax_withheld: withholding,
        agency_commission: commission,
      });

      return [{
        lease_id: lease.id,
        property_title: lease.property.title,
        tenant_name: lease.tenant.name,
        agency_name: lease.agency?.trade_name ?? '—',
        rent_due_day: lease.rent_due_day,
        tax_due_day: lease.tax_due_day,
        condo_due_day: lease.condo_due_day,
        gross_amount: gross,
        property_tax_refund: iptu,
        income_tax_withheld: withholding,
        agency_commission: commission,
        net_amount: net,
        rent_due_date: dateKey(dueDate),
        pending_transaction_ids: transactions.map((transaction) => transaction.id),
        amount_matches: amountMatches(net, input.credited_amount),
      }];
    });

    return sortCandidates(candidates);
  }

  async complete(companyId: string, input: CompleteCreditReconciliationInput) {
    // Reexecuta a busca no servidor: não confia em IDs ou valores calculados no
    // navegador e evita concluir parcelas que mudaram desde a pesquisa.
    const candidates = await this.search(companyId, input);
    const candidate = candidates.find((item) => item.lease_id === input.lease_id);
    if (!candidate) return { lease_id: input.lease_id, updated_transactions: 0 };

    const creditDate = parseCalendarDate(input.credit_date);
    const result = await prisma.transaction.updateMany({
      where: {
        company_id: companyId,
        id: { in: candidate.pending_transaction_ids },
        lease_id: input.lease_id,
        financial_institution_id: input.financial_institution_id,
        status: 'PENDING',
        deleted_at: null,
      },
      data: {
        status: 'COMPLETED',
        effective_date: createDateLocal(creditDate.getFullYear(), creditDate.getMonth() + 1, creditDate.getDate()),
      },
    });

    return { lease_id: input.lease_id, updated_transactions: result.count };
  }
}
