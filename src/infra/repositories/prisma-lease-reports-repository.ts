import prisma from '@/infra/database/prisma';
import type { LeaseReportsRepository } from '@/core/repositories/lease-reports-repository';
import {
  computeNetAmount,
  monthsOfQuarter,
  quartersOf,
  round2,
  MONTHLY_DARF_RATES,
  QUARTERLY_DARF_RATES,
  WITHHOLDING_RATES,
  WITHHOLDING_TOTAL_RATE,
  type LeaseReportParams,
  type LeaseReportResult,
  type LeaseReportRow,
  type MonthlyDarfRow,
  type QuarterlyDarfRow,
  type ReferenceMonth,
  type WithholdingSummary,
  type WithholdingTax,
} from '@/core/entities/lease-report';
import { createDateLocal } from '@/shared/utils/date-utils';
import { matchReportLease, normalizeReportText } from '@/core/entities/lease-report-matching';

/**
 * Implementação Prisma de {@link LeaseReportsRepository}.
 * Tenant-scoped: `Transaction` e `Lease` estão em TENANT_MODELS.
 *
 * ── De onde vem cada coluna ─────────────────────────────────────────────────
 * Classifica os lançamentos gerados pela locação e os avulsos importados
 * pelas descrições, categorias e marca de multa. Receitas e despesas são
 * distinguidas para que pagamento de IPTU não vire restituição.
 *
 * ── Mês de referência ───────────────────────────────────────────────────────
 * Usa o mês da data efetiva dos lançamentos concluídos. Lançamentos antigos
 * sem vínculo são associados por contrato exato ou endereço inequívoco.
 *
 * Camada: infra.
 */

type TransactionKind = 'rent' | 'commission' | 'iptu' | 'penalty' | 'withholding' | 'other';

interface RawLeaseTransaction {
  amount: unknown;
  description: string;
  is_cancellation_charge: boolean;
  lease_id: string | null;
  category?: { type: string } | null;
  subcategory?: { name: string } | null;
}

/** Primeiro e último dia (UTC) do mês informado. */
function monthWindow({ year, month }: ReferenceMonth): { gte: Date; lte: Date } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { gte: createDateLocal(year, month, 1), lte: createDateLocal(year, month, lastDay) };
}

/** Marcas de acentuação combinantes (U+0300–U+036F) deixadas pelo NFD. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Reconhece os prefixos gerados pelo sistema e as categorias da base antiga.
 */
function classify(tx: RawLeaseTransaction): TransactionKind {
  const description = normalizeReportText(tx.description ?? '');
  const subcategory = normalizeReportText(tx.subcategory?.name ?? '');
  if (tx.is_cancellation_charge && tx.category?.type !== 'EXPENSE') return 'penalty';
  if (tx.category?.type === 'EXPENSE' && description.startsWith('irrf') && description.includes('aluguel')) return 'withholding';
  if (tx.category?.type === 'INCOME') {
    if (subcategory === 'restituicao iptu' || description.startsWith('restituicao iptu')) return 'iptu';
    if (description.startsWith('multa') || subcategory.includes('multa')) return 'penalty';
    if (description.includes('aluguel') || subcategory === 'alugueis') return 'rent';
    return 'other';
  }
  if (tx.category?.type === 'EXPENSE' && description.includes('comissao')) return 'commission';
  if (tx.category?.type) return 'other';
  const first = String(tx.description ?? '')
    .trim()
    .split(/\s+/)[0]
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase();
  if (first === 'aluguel') return 'rent';
  if (first === 'comissao') return 'commission';
  if (first === 'restituicao') return 'iptu';
  return 'other';
}

/** Acumulador mutável de uma linha, antes de fechar os totais. */
interface RowAccumulator {
  lease_id: string;
  agency_name: string;
  property_title: string;
  tenant_name: string;
  tenant_document: string | null;
  has_withholding: boolean;
  gross_revenue: number;
  received_amount: number;
  discount_expense: number;
  penalty: number;
  property_tax_refund: number;
  agency_share: number;
  withholding: number;
}

export class PrismaLeaseReportsRepository implements LeaseReportsRepository {
  /**
   * Soma, por locação, os lançamentos creditados nos meses informados.
   * Devolve também o total de receita bruta por mês de referência, que é a
   * base dos DARF.
   */
  private async aggregate(months: ReferenceMonth[]): Promise<{
    rows: Map<string, RowAccumulator>;
    /** Receita bruta total por mês de referência, chaveada por "YYYY-MM". */
    revenueByMonth: Map<string, number>;
    /** Receita bruta dos imóveis COM IRRF, por mês de referência. */
    withholdingBaseByMonth: Map<string, number>;
    unmatched: Array<{ id: string; description: string; amount: number; date: Date }>;
    warnings: string[];
  }> {
    const rows = new Map<string, RowAccumulator>();
    const revenueByMonth = new Map<string, number>();
    const withholdingBaseByMonth = new Map<string, number>();
    const unmatched: Array<{ id: string; description: string; amount: number; date: Date }> = [];
    const warnings: string[] = [];
    if (months.length === 0) return { rows, revenueByMonth, withholdingBaseByMonth, unmatched, warnings };
    const leases = await prisma.lease.findMany({
      where: { deleted_at: null },
      select: {
        id: true, contract_number: true, start_date: true, end_date: true, canceled_at: true,
        discount_amount: true,
        agency: { select: { trade_name: true } },
        property: { select: { title: true, income_tax_withholding: true, agency: { select: { trade_name: true } } } },
        tenant: { select: { name: true, cpf: true, cnpj: true } },
      },
    });
    const leasesById = new Map(leases.map((lease) => [lease.id, lease]));

    // Uma query por mês de referência: os totais mensais dos DARF precisam da
    // separação por mês, e um OR de janelas voltaria tudo achatado.
    for (const reference of months) {
      const key = `${reference.year}-${String(reference.month).padStart(2, '0')}`;
      const window = monthWindow(reference);

      const transactions = await prisma.transaction.findMany({
        where: {
          deleted_at: null,
          status: 'COMPLETED',
          is_transfer: false,
          effective_date: window,
        },
        select: {
          id: true,
          effective_date: true,
          category: { select: { type: true } },
          subcategory: { select: { name: true } },
          amount: true,
          description: true,
          is_cancellation_charge: true,
          lease_id: true,
        },
      });

      // Desconto/despesa é valor da locação, não do lançamento: soma uma vez
      // por locação POR MÊS de referência em que ela teve movimento — senão o
      // desconto de um contrato apareceria multiplicado pelo nº de parcelas.
      const discountCharged = new Set<string>();
      const rentByLease = new Map<string, number>();
      const recordedWithholding = new Map<string, number>();

      for (const tx of transactions) {
        const kind = classify(tx);
        if (kind === 'other') continue;
        const lease = tx.lease_id ? leasesById.get(tx.lease_id)
          : matchReportLease(tx.description, tx.effective_date, leases);
        if (!lease) {
          unmatched.push({ id: tx.id, description: tx.description, amount: Number(tx.amount), date: tx.effective_date });
          continue;
        }

        const leaseId = lease.id;
        let row = rows.get(leaseId);
        if (!row) {
          row = {
            lease_id: leaseId,
            agency_name: lease.agency?.trade_name ?? lease.property?.agency?.trade_name ?? '—',
            property_title: lease.property?.title ?? '—',
            tenant_name: lease.tenant?.name ?? '—',
            tenant_document: lease.tenant?.cpf || lease.tenant?.cnpj || null,
            has_withholding: lease.property?.income_tax_withholding === true,
            gross_revenue: 0,
            received_amount: 0,
            discount_expense: 0,
            penalty: 0,
            property_tax_refund: 0,
            agency_share: 0,
            withholding: 0,
          };
          rows.set(leaseId, row);
        }

        const amount = Number(tx.amount ?? 0);

        switch (kind) {
          case 'rent': {
            if (/^saldo (locacao|aluguel)\b/.test(normalizeReportText(tx.description))) {
              warnings.push(`${key}: "${tx.description}" foi incluído pelo valor registrado. Confira se o saldo já está líquido de comissão antes de usar o faturamento na apuração.`);
            }
            row.gross_revenue = round2(row.gross_revenue + amount);
            // A consulta inclui somente lançamentos efetivamente concluídos.
            row.received_amount = round2(row.received_amount + amount);
            revenueByMonth.set(key, round2((revenueByMonth.get(key) ?? 0) + amount));
            rentByLease.set(leaseId, round2((rentByLease.get(leaseId) ?? 0) + amount));
            const discountKey = `${key}::${leaseId}`;
            if (!discountCharged.has(discountKey)) {
              discountCharged.add(discountKey);
              row.discount_expense = round2(row.discount_expense + Number(lease.discount_amount ?? 0));
            }
            break;
          }
          case 'commission':
            row.agency_share = round2(row.agency_share + amount);
            break;
          case 'iptu':
            row.property_tax_refund = round2(row.property_tax_refund + amount);
            break;
          case 'penalty':
            row.penalty = round2(row.penalty + amount);
            row.received_amount = round2(row.received_amount + amount);
            revenueByMonth.set(key, round2((revenueByMonth.get(key) ?? 0) + amount));
            break;
          case 'withholding':
            row.has_withholding = true;
            recordedWithholding.set(leaseId, round2((recordedWithholding.get(leaseId) ?? 0) + amount));
            break;
        }
      }
      for (const leaseId of new Set([...rentByLease.keys(), ...recordedWithholding.keys()])) {
        const row = rows.get(leaseId)!;
        const rent = rentByLease.get(leaseId) ?? 0;
        const recorded = recordedWithholding.get(leaseId);
        const expected = round2(rent * WITHHOLDING_TOTAL_RATE);
        const hasWithholdingThisMonth = recorded !== undefined || leasesById.get(leaseId)?.property.income_tax_withholding === true;
        row.withholding = round2(row.withholding + (recorded ?? (hasWithholdingThisMonth ? expected : 0)));
        if (hasWithholdingThisMonth) {
          withholdingBaseByMonth.set(key, round2((withholdingBaseByMonth.get(key) ?? 0) + rent));
        }
        if (recorded !== undefined && Math.abs(recorded - expected) > 0.01) {
          warnings.push(`${key}: retenção registrada de ${row.property_title} (${recorded.toFixed(2)}) difere da calculada sobre o aluguel (${expected.toFixed(2)}). O líquido usa a retenção registrada; confira a distribuição por imposto nos quadros fiscais.`);
        }
      }
    }

    return { rows, revenueByMonth, withholdingBaseByMonth, unmatched, warnings };
  }

  /** @inheritdoc */
  async getLeaseReport(params: LeaseReportParams): Promise<LeaseReportResult> {
    const months = [...new Map(params.months.map((month) => [`${month.year}-${month.month}`, month])).values()]
      .sort((a, b) => a.year - b.year || a.month - b.month);
    const { rows: accumulators, revenueByMonth, withholdingBaseByMonth, unmatched, warnings } = await this.aggregate(months);

    // ── Linhas ───────────────────────────────────────────────────────────────
    const rows: LeaseReportRow[] = [...accumulators.values()]
      .map((acc) => {
        const withholding = acc.withholding;
        const base = {
          gross_revenue: acc.gross_revenue,
          received_amount: acc.received_amount,
          discount_expense: acc.discount_expense,
          penalty: acc.penalty,
          property_tax_refund: acc.property_tax_refund,
          withholding,
          agency_share: acc.agency_share,
        };
        return {
          lease_id: acc.lease_id,
          agency_name: acc.agency_name,
          property_title: acc.property_title,
          tenant_name: acc.tenant_name,
          tenant_document: acc.tenant_document,
          has_withholding: acc.has_withholding,
          ...base,
          net_amount: computeNetAmount(base),
        };
      })
      .sort((a, b) => a.agency_name.localeCompare(b.agency_name, 'pt-BR') || a.property_title.localeCompare(b.property_title, 'pt-BR'));

    const sum = (pick: (row: LeaseReportRow) => number) => round2(rows.reduce((acc, row) => acc + pick(row), 0));
    const totals = {
      gross_revenue: sum((r) => r.gross_revenue),
      received_amount: sum((r) => r.received_amount),
      discount_expense: sum((r) => r.discount_expense),
      penalty: sum((r) => r.penalty),
      property_tax_refund: sum((r) => r.property_tax_refund),
      withholding: sum((r) => r.withholding),
      agency_share: sum((r) => r.agency_share),
      net_amount: sum((r) => r.net_amount),
    };

    // ── Quadro Retenções dos Aluguéis ────────────────────────────────────────
    const withholdingBase = round2([...withholdingBaseByMonth.values()].reduce((acc, value) => acc + value, 0));
    const withholdingAmounts = Object.fromEntries(
      (Object.keys(WITHHOLDING_RATES) as WithholdingTax[]).map((tax) => [tax, round2(withholdingBase * WITHHOLDING_RATES[tax])]),
    ) as Record<WithholdingTax, number>;
    const withholding: WithholdingSummary = {
      base: withholdingBase,
      amounts: withholdingAmounts,
      total: totals.withholding,
    };

    // ── Quadro DARF mensal (PIS/COFINS) ──────────────────────────────────────
    const monthlyDarf: MonthlyDarfRow[] = months.flatMap((reference) => {
      const key = `${reference.year}-${String(reference.month).padStart(2, '0')}`;
      const revenue = revenueByMonth.get(key) ?? 0;
      const withheldBase = withholdingBaseByMonth.get(key) ?? 0;
      return (['pis', 'cofins'] as const).map((tax) => {
        const darf = round2(revenue * MONTHLY_DARF_RATES[tax]);
        const withheld = round2(withheldBase * WITHHOLDING_RATES[tax]);
        return { reference, tax, rate: MONTHLY_DARF_RATES[tax], revenue, darf, withheld, payable: round2(Math.max(darf - withheld, 0)) };
      });
    });

    // ── Quadro DARF trimestral (CSLL/IRPJ) ───────────────────────────────────
    // O trimestre entra INTEIRO, mesmo que o usuário tenha selecionado só um
    // mês dele: o DARF trimestral incide sobre o faturamento dos 3 meses, e
    // apurá-lo sobre um mês só produziria um valor a pagar errado.
    const quarters = quartersOf(months);
    const quarterlyDarf: QuarterlyDarfRow[] = [];
    for (const reference of quarters) {
      const quarterMonths = monthsOfQuarter(reference);
      const missing = quarterMonths.filter(
        (m) => !months.some((sel) => sel.year === m.year && sel.month === m.month),
      );
      const extra = missing.length > 0 ? await this.aggregate(missing) : null;
      if (extra) {
        warnings.push(...extra.warnings);
        for (const item of extra.unmatched) {
          warnings.push(`Apuração trimestral: lançamento sem locação identificada: ${item.description} (${item.amount.toFixed(2)}).`);
        }
      }

      const revenue = round2(
        quarterMonths.reduce((acc, m) => {
          const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
          return acc + (revenueByMonth.get(key) ?? extra?.revenueByMonth.get(key) ?? 0);
        }, 0),
      );
      const withheldBase = round2(
        quarterMonths.reduce((acc, m) => {
          const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
          return acc + (withholdingBaseByMonth.get(key) ?? extra?.withholdingBaseByMonth.get(key) ?? 0);
        }, 0),
      );

      (['csll', 'irpj'] as const).forEach((tax) => {
        const darf = round2(revenue * QUARTERLY_DARF_RATES[tax]);
        const withheld = round2(withheldBase * WITHHOLDING_RATES[tax]);
        quarterlyDarf.push({ reference, tax, rate: QUARTERLY_DARF_RATES[tax], revenue, darf, withheld, payable: round2(Math.max(darf - withheld, 0)) });
      });
    }

    // ── Quadro Resgate de Aplicações Financeiras ─────────────────────────────
    // Só devolve os trimestres cobertos: rendimento e IR retido são digitados
    // na tela (não há origem confiável no financeiro para um resgate), e as
    // linhas são montadas lá por `buildRedemptionRows`.

    return { months, rows, totals, withholding, monthlyDarf, quarterlyDarf, quarters, unmatched, warnings };
  }
}

export const prismaLeaseReportsRepository = new PrismaLeaseReportsRepository();
