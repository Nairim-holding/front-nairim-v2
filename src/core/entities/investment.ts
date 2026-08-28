/**
 * Entidades de domínio: Investimentos (tela "Meus Investimentos").
 *
 * Modelo (ver prisma/schema.prisma):
 *  - `Investment`             — o papel em carteira. Aponta para uma
 *    FinancialInstitution já cadastrada; `partition` é a conta dentro dela.
 *  - `InvestmentTransaction`  — aportes/resgates. A aplicação inicial nasce
 *    como o primeiro registro, então a linha "Aplicado" da grid é sempre a
 *    soma das transações do mês (vários aportes no mesmo mês somam).
 *  - `InvestmentMonthBalance` — "Saldo Total" do mês, digitado pelo usuário.
 *
 * Regra do saldo efetivo de um mês (a mesma que a grid exibe):
 *   saldo(m) = saldo informado em m,
 *              senão saldo(m-1) + aplicado(m),
 *              senão null (célula em branco — antes da 1ª aplicação).
 *
 * Derivados do cabeçalho fixo:
 *   Rendimento Mensal(m)        = saldo(m) − saldo(m−1) − aplicado(m)
 *   Grau de Indep. Financeira(m)= Rendimento(m) ÷ valor de referência
 *   Saldo Dos Investimentos(m)  = Σ saldo(m) de todos os investimentos
 *   Valor Total Aplicado(m)     = Σ aplicado(m) de todos os investimentos
 *
 * Camada: core.
 */

export type InvestmentProductType =
  | 'CDB'
  | 'RDB'
  | 'LCI'
  | 'LCA'
  | 'LC'
  | 'LF'
  | 'TESOURO_DIRETO'
  | 'POUPANCA'
  | 'DEBENTURE'
  | 'CRI'
  | 'CRA'
  | 'COE'
  | 'FUNDO'
  | 'PREVIDENCIA'
  | 'ACAO'
  | 'FII'
  | 'ETF'
  | 'BDR'
  | 'CRIPTO'
  | 'OUTRO';

export type InvestmentTransactionType = 'CONTRIBUTION' | 'REDEMPTION';

/** Registro bruto de investimento (sem os agregados da grid). */
export interface Investment {
  id: string;
  company_id: string;
  financial_institution_id: string;
  partition: string;
  issuer: string;
  product_type: InvestmentProductType;
  product: string;
  /** YYYY-MM-DD */
  application_date: string;
  /** YYYY-MM-DD */
  maturity_date: string | null;
  liquidity_days: number | null;
  liquidity_at_maturity: boolean;
  invested_amount: number;
  notes: string | null;
  display_order: number;
  /** YYYY-MM-DD — preenchido quando o investimento foi liquidado. */
  liquidated_at: string | null;
  is_active: boolean;
  /** Nome da instituição, para montar "Inst. Fin. - Partição". */
  financial_institution_name?: string;
}

export interface CreateInvestmentData {
  financial_institution_id: string;
  partition?: string;
  issuer: string;
  product_type: InvestmentProductType;
  product: string;
  application_date: string;
  maturity_date?: string | null;
  liquidity_days?: number | null;
  liquidity_at_maturity?: boolean;
  invested_amount: number;
  notes?: string | null;
}

export type UpdateInvestmentData = Partial<CreateInvestmentData> & {
  liquidated_at?: string | null;
};

/** Aporte/resgate individual (modal "Gerenciar Aportes e Resgates"). */
export interface InvestmentTransactionEntry {
  id: string;
  investment_id: string;
  type: InvestmentTransactionType;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
}

export interface UpsertInvestmentTransactionData {
  investment_id: string;
  type?: InvestmentTransactionType;
  date: string;
  amount: number;
}

/** Um mês da grid, já com o valor aplicado e o saldo efetivo resolvidos. */
export interface InvestmentMonthCell {
  year: number;
  month: number;
  /** Soma dos aportes (menos resgates) do mês. 0 quando não houve movimento. */
  applied: number;
  /** Saldo efetivo do mês; null = célula em branco. */
  balance: number | null;
  /** true quando o saldo foi digitado pelo usuário (e não herdado). */
  balance_is_manual: boolean;
}

/** Linha da grid: um investimento com seus meses. */
export interface InvestmentRow extends Investment {
  /** "Corretora ABC - Principal" */
  institution_label: string;
  months: InvestmentMonthCell[];
}

/** Linha do cabeçalho fixo (um valor por mês exibido). */
export interface InvestmentSummaryRow {
  year: number;
  month: number;
  /** Rendimento Mensal */
  yield_amount: number;
  /** Grau de Indep. Financeira, em % (0-∞). */
  independence_degree: number;
  /** Saldo Dos Investimentos */
  total_balance: number;
  /** Valor Total Aplicado */
  total_applied: number;
}

export interface InvestmentDashboardFilters {
  [field: string]: string[];
}

/** Parâmetros do dashboard: janela em meses (YYYY-MM) + filtros da tela. */
export interface InvestmentDashboardParams {
  /** YYYY-MM */
  startMonth: string;
  /** YYYY-MM */
  endMonth: string;
  filters?: InvestmentDashboardFilters;
}

/** Resposta consumida por `InvestmentsTable`. */
export interface InvestmentDashboardResponse {
  start_month: string;
  end_month: string;
  months: { year: number; month: number }[];
  investments: InvestmentRow[];
  summary: InvestmentSummaryRow[];
  /** Soma do planejado de DESPESA do mês corrente. */
  planned_expenses_current_month: number;
  /** Valor de referência da independência financeira; null = nunca configurado. */
  independence_reference_amount: number | null;
  /**
   * Denominador de fato do Grau de Indep. Financeira — o valor de referência
   * quando configurado, senão os gastos planejados do mês. É ele que a pill à
   * esquerda exibe, para o número mostrado ser sempre o mesmo que produz o
   * percentual do indicador.
   */
  independence_base: number;
}

/** Configuração da tela (modal "Editar Independência Financeira"). */
export interface InvestmentSettings {
  independence_reference_amount: number | null;
}
