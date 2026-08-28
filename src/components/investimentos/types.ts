/**
 * Tipos da tela "Meus Investimentos", reexportados do core.
 *
 * Diferente de `components/planejamento/types.ts` (que duplica as interfaces),
 * aqui só há reexport: os tipos do core já são o shape exato que a Server
 * Action devolve, então duplicá-los só criaria duas verdades para manter.
 */
export type {
  Investment,
  InvestmentDashboardResponse,
  InvestmentMonthCell,
  InvestmentProductType,
  InvestmentRow,
  InvestmentSettings,
  InvestmentSummaryRow,
  InvestmentTransactionEntry,
  InvestmentTransactionType,
} from '@/core/entities/investment';

/** Mês exibido na grid. */
export interface GridMonth {
  year: number;
  month: number;
}

/** Alvo dos modais que operam em uma célula (mês de um investimento). */
export interface MonthCellTarget {
  investmentId: string;
  year: number;
  month: number;
}
