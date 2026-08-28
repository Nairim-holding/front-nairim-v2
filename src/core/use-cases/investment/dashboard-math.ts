/**
 * Regras de cálculo da grid de Investimentos, isoladas do Prisma.
 *
 * Ficam aqui — e não dentro do repositório — porque são a parte da tela que
 * realmente pode errar em silêncio: um saldo herdado a mais e o "Rendimento
 * Mensal" inteiro sai errado. Como funções puras, são verificáveis sem banco
 * (ver `__tests__/dashboard-math.test.ts`).
 *
 * Camada: core.
 */

export interface GridMonth {
  year: number;
  month: number;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Expande "YYYY-MM".."YYYY-MM" na lista de meses (inclusiva). */
export function expandMonths(startMonth: string, endMonth: string): GridMonth[] {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  if (startMonth > endMonth) return [];

  const months: GridMonth[] = [];
  let year = sy;
  let month = sm;
  // Trava de segurança: a tela nunca pede mais que algumas dezenas de meses.
  for (let guard = 0; guard < 600; guard++) {
    months.push({ year, month });
    if (year === ey && month === em) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function previousMonth(year: number, month: number): GridMonth {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/**
 * Resolve o "Saldo Total" de cada mês da série:
 *   saldo(m) = saldo informado em m,
 *              senão saldo(m−1) + aplicado(m),
 *              senão null (antes de existir qualquer movimento).
 *
 * @param months meses a percorrer, em ordem cronológica.
 * @param applied aplicado por mês (aportes − resgates), chaveado por `monthKey`.
 * @param manual saldos informados pelo usuário, chaveados por `monthKey`.
 */
export function resolveBalanceSeries(
  months: GridMonth[],
  applied: Map<string, number>,
  manual: Map<string, number>,
): Map<string, number | null> {
  const resolved = new Map<string, number | null>();
  let running: number | null = null;

  for (const { year, month } of months) {
    const key = monthKey(year, month);
    const manualValue = manual.get(key);

    if (manualValue !== undefined) {
      running = manualValue;
    } else {
      const appliedValue = applied.get(key) ?? 0;
      running = running === null ? (appliedValue !== 0 ? appliedValue : null) : running + appliedValue;
    }

    resolved.set(key, running === null ? null : round2(running));
  }

  return resolved;
}

export interface SummaryInput {
  /** Série de saldos de um investimento, já resolvida. */
  balances: Map<string, number | null>;
  /** Aplicado por mês do mesmo investimento. */
  applied: Map<string, number>;
}

export interface SummaryRow {
  year: number;
  month: number;
  yield_amount: number;
  independence_degree: number;
  total_balance: number;
  total_applied: number;
}

/**
 * Consolida as quatro linhas do cabeçalho fixo.
 *
 * O Rendimento desconta o que entrou de dinheiro novo no mês — senão um aporte
 * seria contado como rendimento:
 *   Rendimento(m) = Saldo(m) − Saldo(m−1) − Aplicado(m)
 */
export function buildSummary(
  months: GridMonth[],
  investments: SummaryInput[],
  independenceBase: number,
): SummaryRow[] {
  return months.map(({ year, month }) => {
    const key = monthKey(year, month);
    const prev = previousMonth(year, month);
    const prevKey = monthKey(prev.year, prev.month);

    let totalBalance = 0;
    let previousBalance = 0;
    let totalApplied = 0;

    for (const investment of investments) {
      totalBalance += investment.balances.get(key) ?? 0;
      previousBalance += investment.balances.get(prevKey) ?? 0;
      totalApplied += investment.applied.get(key) ?? 0;
    }

    const yieldAmount = round2(totalBalance - previousBalance - totalApplied);

    return {
      year,
      month,
      yield_amount: yieldAmount,
      independence_degree:
        independenceBase > 0 ? Math.round((yieldAmount / independenceBase) * 10000) / 100 : 0,
      total_balance: round2(totalBalance),
      total_applied: round2(totalApplied),
    };
  });
}
