/**
 * Entidades e regras fiscais do Relatório de Locações
 * (menu Locações > Relatórios).
 *
 * O relatório é sempre pedido por MÊS DE REFERÊNCIA, não por data de
 * lançamento: o aluguel de Dezembro/2025 é creditado em Janeiro/2026. Isso
 * casa com a geração automática dos lançamentos da locação
 * (PrismaLeaseFinanceRepository), que emite a primeira parcela um mês DEPOIS
 * do início do contrato — ver `monthsBetween(...).slice(1)` lá.
 *
 * ⚠️ Nome de arquivo SINGULAR em todas as camadas (`lease-report.ts`), pelo
 * mesmo motivo documentado em `financial-report.ts`.
 *
 * Camada: core (regra pura, sem I/O).
 */

/** Mês de referência escolhido pelo usuário (o crédito cai no mês seguinte). */
export interface ReferenceMonth {
  year: number;
  /** 1–12. */
  month: number;
}

export interface LeaseReportParams {
  /** Um ou mais meses de referência; a tabela agrega todos eles. */
  months: ReferenceMonth[];
}

/** Uma linha da tabela — uma locação, somada sobre os meses selecionados. */
export interface LeaseReportRow {
  lease_id: string;
  /** Nome da imobiliária em que o imóvel está locado. */
  agency_name: string;
  /** Nome/identificação do imóvel. */
  property_title: string;
  /** Valor bruto da locação no período (CR). */
  gross_revenue: number;
  /** Valor recebido informado pelo lançamento de aluguel da locação (CR). */
  received_amount: number;
  /** Desconto ou despesa informada na locação (DB). */
  discount_expense: number;
  /** Multa da locação ou do encerramento (CR). */
  penalty: number;
  /** Restituição de IPTU (CR). */
  property_tax_refund: number;
  /** IRRF retido sobre o aluguel (DB) — só para imóveis marcados com IRRF. */
  withholding: number;
  /** Parte que fica com a imobiliária, i.e. a comissão (DB). */
  agency_share: number;
  /** Recebido + Multa + IPTU − Desconto − Retenções − Parte da Imobiliária. */
  net_amount: number;
  tenant_name: string;
  tenant_document: string | null;
  /** Imóvel marcado como sujeito a IRRF no cadastro. */
  has_withholding: boolean;
}

// ─── Alíquotas ───────────────────────────────────────────────────────────────

/**
 * Alíquotas de retenção na fonte sobre o aluguel (quadro "Retenções dos
 * Aluguéis"). Constantes de lei — mudam por norma, não por empresa, então
 * ficam aqui e não em configuração por tenant.
 */
export const WITHHOLDING_RATES = {
  pis: 0.0065,
  cofins: 0.03,
  irpj: 0.048,
  csll: 0.01,
} as const;

export type WithholdingTax = keyof typeof WITHHOLDING_RATES;

export const WITHHOLDING_TOTAL_RATE =
  WITHHOLDING_RATES.pis + WITHHOLDING_RATES.cofins + WITHHOLDING_RATES.irpj + WITHHOLDING_RATES.csll; // 9,45%

/**
 * Alíquotas do DARF mensal (PIS/COFINS cumulativos sobre o faturamento).
 * Mesmas alíquotas da retenção — o que muda é a base: o DARF incide sobre o
 * faturamento TOTAL de aluguéis, e a retenção (só dos imóveis com IRRF) é
 * abatida do valor a pagar.
 */
export const MONTHLY_DARF_RATES = {
  pis: WITHHOLDING_RATES.pis,
  cofins: WITHHOLDING_RATES.cofins,
} as const;

/**
 * Alíquotas efetivas do DARF trimestral no lucro presumido para locação de
 * imóveis próprios: presunção de 32% sobre a receita, × 9% de CSLL e × 15% de
 * IRPJ. Daí 2,88% e 4,80% sobre o faturamento do trimestre.
 */
export const PRESUMED_PROFIT_RATE = 0.32;
export const QUARTERLY_DARF_RATES = {
  csll: PRESUMED_PROFIT_RATE * 0.09, // 2,88%
  irpj: PRESUMED_PROFIT_RATE * 0.15, // 4,80%
} as const;

/** Alíquotas sobre o rendimento resgatado de aplicações financeiras (PJ). */
export const INVESTMENT_REDEMPTION_RATES = {
  csll: 0.09,
  irpj: 0.15,
} as const;

// ─── Quadros ─────────────────────────────────────────────────────────────────

/** Quadro "Retenções dos Aluguéis" — só os imóveis marcados com IRRF. */
export interface WithholdingSummary {
  /** Soma da receita bruta dos imóveis sujeitos a IRRF. */
  base: number;
  amounts: Record<WithholdingTax, number>;
  total: number;
}

/** Uma linha do quadro de DARF mensal (um imposto, num mês de referência). */
export interface MonthlyDarfRow {
  reference: ReferenceMonth;
  tax: 'pis' | 'cofins';
  rate: number;
  /** Faturamento total de aluguéis do mês (base do DARF). */
  revenue: number;
  /** Faturamento × alíquota. */
  darf: number;
  /** Retenção do mesmo imposto, sofrida no mês. */
  withheld: number;
  /** DARF − retenção, nunca negativo. */
  payable: number;
}

/** Trimestre-calendário coberto pelos meses de referência selecionados. */
export interface Quarter {
  year: number;
  /** 1–4. */
  quarter: number;
}

/** Uma linha do quadro de DARF trimestral (um imposto, num trimestre). */
export interface QuarterlyDarfRow {
  reference: Quarter;
  tax: 'csll' | 'irpj';
  rate: number;
  /** Faturamento de aluguéis do trimestre inteiro (independe da seleção). */
  revenue: number;
  darf: number;
  /** Retenção do mesmo imposto acumulada nos 3 meses do trimestre. */
  withheld: number;
  payable: number;
}

/** Entrada digitada na tela para o quadro de Resgate de Aplicações. */
export interface InvestmentRedemptionInput {
  year: number;
  /** 1–4. */
  quarter: number;
  /** Rendimento resgatado da aplicação no trimestre. */
  income: number;
  /** IR já retido na fonte pela instituição sobre esse rendimento. */
  tax_withheld: number;
}

export interface InvestmentRedemptionRow {
  reference: Quarter;
  tax: 'csll' | 'irpj';
  rate: number;
  income: number;
  tax_withheld: number;
  /** Imposto devido sobre o rendimento, já descontado o IR retido (IRPJ). */
  payable: number;
}

export interface LeaseReportResult {
  months: ReferenceMonth[];
  rows: LeaseReportRow[];
  totals: Omit<LeaseReportRow, 'lease_id' | 'agency_name' | 'property_title' | 'tenant_name' | 'tenant_document' | 'has_withholding'>;
  withholding: WithholdingSummary;
  monthlyDarf: MonthlyDarfRow[];
  quarterlyDarf: QuarterlyDarfRow[];
  /** Trimestres cobertos pela seleção — o quadro de Resgate é preenchido na tela. */
  quarters: Quarter[];
}

/**
 * Linhas do quadro de Resgate a partir dos valores digitados. Roda no
 * cliente: são dados de tela, e recalcular no servidor a cada tecla só
 * adicionaria round-trip sem mudar o resultado.
 */
export function buildRedemptionRows(quarters: Quarter[], inputs: InvestmentRedemptionInput[]): InvestmentRedemptionRow[] {
  return quarters.flatMap((reference) => {
    const input = inputs.find((i) => i.year === reference.year && i.quarter === reference.quarter)
      ?? { year: reference.year, quarter: reference.quarter, income: 0, tax_withheld: 0 };
    return (['csll', 'irpj'] as const).map((tax) => ({
      reference,
      tax,
      rate: INVESTMENT_REDEMPTION_RATES[tax],
      income: input.income,
      tax_withheld: input.tax_withheld,
      payable: computeRedemptionPayable(tax, input),
    }));
  });
}

// ─── Helpers puros ───────────────────────────────────────────────────────────

export const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

/** Mês em que o aluguel do mês de referência é creditado (referência + 1). */
export function creditMonthOf({ year, month }: ReferenceMonth): ReferenceMonth {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** Trimestres-calendário distintos cobertos pelos meses de referência. */
export function quartersOf(months: ReferenceMonth[]): Quarter[] {
  const seen = new Map<string, Quarter>();
  months.forEach((m) => {
    const q: Quarter = { year: m.year, quarter: Math.floor((m.month - 1) / 3) + 1 };
    seen.set(`${q.year}-${q.quarter}`, q);
  });
  return [...seen.values()].sort((a, b) => a.year - b.year || a.quarter - b.quarter);
}

/** Os 3 meses de referência de um trimestre-calendário. */
export function monthsOfQuarter({ year, quarter }: Quarter): ReferenceMonth[] {
  const first = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map((offset) => ({ year, month: first + offset }));
}

/** Valor líquido da linha, na fórmula definida pelo cliente. */
export function computeNetAmount(row: Omit<LeaseReportRow, 'net_amount' | 'lease_id' | 'agency_name' | 'property_title' | 'tenant_name' | 'tenant_document' | 'has_withholding'>): number {
  return round2(
    row.received_amount + row.penalty + row.property_tax_refund
      - row.discount_expense - row.withholding - row.agency_share,
  );
}

/** Imposto devido sobre o rendimento de aplicação, por tributo. */
export function computeRedemptionPayable(tax: 'csll' | 'irpj', input: InvestmentRedemptionInput): number {
  const due = round2(input.income * INVESTMENT_REDEMPTION_RATES[tax]);
  // O IR retido pela instituição é antecipação de IRPJ — só abate o IRPJ.
  // A CSLL não tem retenção correspondente, então é devida integralmente.
  if (tax === 'csll') return due;
  return round2(Math.max(due - input.tax_withheld, 0));
}
