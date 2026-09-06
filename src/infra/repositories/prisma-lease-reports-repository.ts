import prisma from '@/infra/database/prisma';
import type { LeaseReportsRepository } from '@/core/repositories/lease-reports-repository';
import {
  computeNetAmount,
  creditMonthOf,
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

/**
 * Implementação Prisma de {@link LeaseReportsRepository}.
 * Tenant-scoped: `Transaction` e `Lease` estão em TENANT_MODELS.
 *
 * ── De onde vem cada coluna ─────────────────────────────────────────────────
 * Os lançamentos da locação são gerados por `PrismaLeaseFinanceRepository`,
 * que grava `lease_id` e uma descrição com prefixo fixo. A classificação aqui
 * usa a MESMA chave que a sincronização usa para idempotência (primeira
 * palavra da descrição: "Aluguel" / "Comissão" / "Restituição") — de
 * propósito: se um dia o prefixo mudar lá, a idempotência do sync quebra
 * junto, então não há como as duas leituras divergirem em silêncio.
 * Multas são os lançamentos com `is_cancellation_charge = true`, marcados no
 * cancelamento da locação.
 *
 * ── Mês de referência ───────────────────────────────────────────────────────
 * O aluguel de Dez/2025 é creditado em Jan/2026, e é assim que os lançamentos
 * são emitidos (primeira parcela um mês após o início do contrato). Então
 * para cada mês de referência a janela consultada é o mês SEGUINTE.
 *
 * Camada: infra.
 */

type TransactionKind = 'rent' | 'commission' | 'iptu' | 'penalty' | 'other';

interface RawLeaseTransaction {
  amount: unknown;
  description: string;
  is_cancellation_charge: boolean;
  lease_id: string | null;
}

/** Primeiro e último dia (UTC) do mês informado. */
function monthWindow({ year, month }: ReferenceMonth): { gte: Date; lte: Date } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { gte: createDateLocal(year, month, 1), lte: createDateLocal(year, month, lastDay) };
}

/** Marcas de acentuação combinantes (U+0300–U+036F) deixadas pelo NFD. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Classifica o lançamento pelo prefixo da descrição gerada pelo sync.
 * Acentuação normalizada porque "Comissão" pode chegar sem acento de bases
 * antigas importadas do backend anterior.
 */
function classify(tx: RawLeaseTransaction): TransactionKind {
  if (tx.is_cancellation_charge) return 'penalty';
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
  }> {
    const rows = new Map<string, RowAccumulator>();
    const revenueByMonth = new Map<string, number>();
    const withholdingBaseByMonth = new Map<string, number>();
    if (months.length === 0) return { rows, revenueByMonth, withholdingBaseByMonth };

    // Uma query por mês de referência: os totais mensais dos DARF precisam da
    // separação por mês, e um OR de janelas voltaria tudo achatado.
    for (const reference of months) {
      const key = `${reference.year}-${String(reference.month).padStart(2, '0')}`;
      const window = monthWindow(creditMonthOf(reference));

      const transactions = await prisma.transaction.findMany({
        where: {
          deleted_at: null,
          lease_id: { not: null },
          effective_date: window,
        },
        select: {
          amount: true,
          description: true,
          is_cancellation_charge: true,
          lease_id: true,
          lease: {
            select: {
              id: true,
              discount_amount: true,
              agency: { select: { trade_name: true } },
              property: { select: { title: true, income_tax_withholding: true, agency: { select: { trade_name: true } } } },
              tenant: { select: { name: true, cpf: true, cnpj: true } },
            },
          },
        },
      });

      // Desconto/despesa é valor da locação, não do lançamento: soma uma vez
      // por locação POR MÊS de referência em que ela teve movimento — senão o
      // desconto de um contrato apareceria multiplicado pelo nº de parcelas.
      const discountCharged = new Set<string>();

      for (const tx of transactions) {
        const lease = tx.lease;
        if (!lease) continue;

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
          };
          rows.set(leaseId, row);
        }

        const amount = Number(tx.amount ?? 0);

        switch (classify(tx as RawLeaseTransaction)) {
          case 'rent': {
            row.gross_revenue = round2(row.gross_revenue + amount);
            // O lançamento gerado pela locação nasce como PENDING e permanece
            // assim até uma baixa manual no Financeiro. O relatório de Locações,
            // porém, usa esse lançamento como a fonte do "Valor Recebido"; filtrar
            // pelo status fazia a coluna inteira ficar zerada nas bases em que as
            // baixas ainda não foram registradas. A situação do lançamento continua
            // disponível no Financeiro, mas não elimina o valor deste relatório.
            row.received_amount = round2(row.received_amount + amount);
            revenueByMonth.set(key, round2((revenueByMonth.get(key) ?? 0) + amount));
            if (row.has_withholding) {
              withholdingBaseByMonth.set(key, round2((withholdingBaseByMonth.get(key) ?? 0) + amount));
            }
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
            break;
          default:
            // Lançamento avulso vinculado à locação — não entra em nenhuma
            // coluna do relatório, que só reporta o schedule + a multa.
            break;
        }
      }
    }

    return { rows, revenueByMonth, withholdingBaseByMonth };
  }

  /** @inheritdoc */
  async getLeaseReport(params: LeaseReportParams): Promise<LeaseReportResult> {
    const months = [...params.months].sort((a, b) => a.year - b.year || a.month - b.month);
    const { rows: accumulators, revenueByMonth, withholdingBaseByMonth } = await this.aggregate(months);

    // ── Linhas ───────────────────────────────────────────────────────────────
    const rows: LeaseReportRow[] = [...accumulators.values()]
      .map((acc) => {
        const withholding = acc.has_withholding
          ? round2(acc.gross_revenue * WITHHOLDING_TOTAL_RATE)
          : 0;
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
    const withholdingBase = round2(rows.filter((r) => r.has_withholding).reduce((acc, r) => acc + r.gross_revenue, 0));
    const withholdingAmounts = Object.fromEntries(
      (Object.keys(WITHHOLDING_RATES) as WithholdingTax[]).map((tax) => [tax, round2(withholdingBase * WITHHOLDING_RATES[tax])]),
    ) as Record<WithholdingTax, number>;
    const withholding: WithholdingSummary = {
      base: withholdingBase,
      amounts: withholdingAmounts,
      total: round2(Object.values(withholdingAmounts).reduce((acc, v) => acc + v, 0)),
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

    return { months, rows, totals, withholding, monthlyDarf, quarterlyDarf, quarters };
  }
}

export const prismaLeaseReportsRepository = new PrismaLeaseReportsRepository();
