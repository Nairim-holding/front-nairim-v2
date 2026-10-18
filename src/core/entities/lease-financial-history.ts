/**
 * Histórico Financeiro da locação: todos os lançamentos ligados ao contrato,
 * inclusive os que foram excluídos pelo cancelamento (valores não recebidos).
 *
 * Camada: core (regra pura, sem I/O).
 */

export type LeaseHistorySituation = 'SETTLED' | 'PENDING' | 'OVERDUE' | 'CANCELED';

/** Uma linha da grid do histórico, já serializável para o cliente. */
export interface LeaseHistoryRow {
  id: string;
  /** "3/11" quando o lançamento é parcela do contrato; "—" caso contrário. */
  installment: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  /** Datas em ISO (yyyy-mm-dd). */
  eventDate: string;
  dueDate: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED';
  situation: LeaseHistorySituation;
  situationLabel: string;
  /** Lançamento excluído pelo cancelamento do contrato. */
  canceled: boolean;
  recurring?: boolean;
}

/** Lançamento sem `lease_id` cuja descrição aponta para este contrato. */
export interface LeaseHistoryCandidate {
  id: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  dueDate: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED';
}

export interface LeaseHistoryTotal {
  count: number;
  amount: number;
}

export interface LeaseFinancialHistory {
  lease: { id: string; contract_number: string; property_title: string; tenant_name: string; canceled: boolean };
  rows: LeaseHistoryRow[];
  /** Totais das RECEITAS do contrato, por situação. */
  totals: Record<LeaseHistorySituation, LeaseHistoryTotal>;
  candidates: LeaseHistoryCandidate[];
  warnings?: string[];
}

export interface LeaseHistorySource {
  status: 'PENDING' | 'COMPLETED';
  effective_date: Date;
  canceled_at: Date | null;
}

const dateOnly = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/**
 * Situação do lançamento no contrato. O cancelamento prevalece: o valor deixou
 * de ser devido, ainda que o vencimento já tenha passado. Vencido é só o que
 * venceu antes de hoje — o próprio dia do vencimento ainda é pendente.
 */
export function leaseHistorySituation(tx: LeaseHistorySource, today: Date): LeaseHistorySituation {
  if (tx.canceled_at) return 'CANCELED';
  if (tx.status === 'COMPLETED') return 'SETTLED';
  return dateOnly(tx.effective_date) < dateOnly(today) ? 'OVERDUE' : 'PENDING';
}

export function leaseHistorySituationLabel(situation: LeaseHistorySituation, type: 'INCOME' | 'EXPENSE'): string {
  switch (situation) {
    case 'SETTLED': return type === 'INCOME' ? 'Recebido' : 'Pago';
    case 'OVERDUE': return 'Em atraso';
    case 'CANCELED': return 'Cancelado';
    default: return 'Pendente';
  }
}

export function installmentLabel(number: number | null, total: number | null): string {
  return number && total ? `${number}/${total}` : '—';
}

/** Totais por situação, considerando só as receitas (o que o contrato rende). */
export function summarizeLeaseHistory(rows: LeaseHistoryRow[]): Record<LeaseHistorySituation, LeaseHistoryTotal> {
  const totals: Record<LeaseHistorySituation, LeaseHistoryTotal> = {
    SETTLED: { count: 0, amount: 0 },
    PENDING: { count: 0, amount: 0 },
    OVERDUE: { count: 0, amount: 0 },
    CANCELED: { count: 0, amount: 0 },
  };
  for (const row of rows) {
    if (row.type !== 'INCOME') continue;
    totals[row.situation].count += 1;
    totals[row.situation].amount += row.amount;
  }
  for (const total of Object.values(totals)) total.amount = Math.round((total.amount + Number.EPSILON) * 100) / 100;
  return totals;
}
