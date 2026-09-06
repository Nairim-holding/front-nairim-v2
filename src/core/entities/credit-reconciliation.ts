/**
 * Conciliação Inteligente de Créditos de Locação
 * (Lançamentos Financeiros > "Identificar Crédito de Locação").
 *
 * O problema que isto resolve: no extrato chegam vários créditos de aluguel no
 * mesmo dia e não dá para saber, olhando o valor, de qual locação é cada um.
 * A busca parte de (data do crédito, valor líquido, imobiliárias) e devolve as
 * locações candidatas.
 *
 * ── Por que a data do crédito não basta ─────────────────────────────────────
 * O aluguel que vence em dia não útil é repassado no próximo dia útil. Então
 * um crédito numa segunda-feira pode ser de um vencimento no sábado ou no
 * domingo anteriores; e se a segunda for feriado, o crédito escorrega para
 * terça e passa a acumular os vencimentos de sábado, domingo, segunda e terça.
 * `dueDaysSettledOn` reconstrói esse conjunto: são todos os dias cujo "próximo
 * dia útil" é exatamente a data do crédito.
 *
 * Camada: core (regra pura, sem I/O).
 */

/** Um feriado já reduzido ao que importa aqui: a data. */
export interface HolidayDate {
  /** Data local do feriado (hora ignorada). */
  date: Date;
}

const MS_PER_DAY = 86_400_000;

/** Chave estável de um dia, para comparar ignorando hora/fuso. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Sábado ou domingo. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isHoliday(date: Date, holidays: HolidayDate[]): boolean {
  const key = dayKey(date);
  return holidays.some((holiday) => dayKey(holiday.date) === key);
}

/** Dia útil financeiro: nem fim de semana, nem feriado. */
export function isBusinessDay(date: Date, holidays: HolidayDate[]): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays);
}

/**
 * Próximo dia útil a partir da data (inclusive): se já for útil, é ela mesma.
 * O limite de 30 iterações evita laço infinito caso alguém cadastre um ano
 * inteiro como feriado.
 */
export function nextBusinessDay(date: Date, holidays: HolidayDate[]): Date {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (let i = 0; i < 30; i += 1) {
    if (isBusinessDay(cursor, holidays)) return cursor;
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

/**
 * Dias do mês cujo vencimento é liquidado na data do crédito.
 *
 * Anda para trás a partir do crédito enquanto os dias anteriores forem não
 * úteis: são eles que "empurraram" o pagamento para a data informada. Se a
 * própria data do crédito não for dia útil, nenhum vencimento é liquidado nela
 * — devolve vazio, em vez de fingir um conjunto que o banco não pagaria.
 *
 * Exemplos do documento do cliente:
 *  - crédito 22/06/2026 (segunda) → dias 20 (sáb), 21 (dom) e 22.
 *  - crédito 13/10/2026 (terça, com 12/10 feriado) → dias 10, 11, 12 e 13.
 */
export function dueDaysSettledOn(creditDate: Date, holidays: HolidayDate[]): number[] {
  return dueDatesSettledOn(creditDate, holidays).map((date) => date.getDate());
}

/**
 * Datas completas cujos vencimentos chegam ao banco na data informada.
 * Diferentemente de `dueDaysSettledOn`, preserva mês e ano — necessário para
 * créditos no começo do mês (ex.: 31/12 liquidado em 02/01).
 */
export function dueDatesSettledOn(creditDate: Date, holidays: HolidayDate[]): Date[] {
  const credit = new Date(creditDate.getFullYear(), creditDate.getMonth(), creditDate.getDate(), 12);
  if (!isBusinessDay(credit, holidays)) return [];

  const dates = [new Date(credit)];
  const cursor = new Date(credit.getTime() - MS_PER_DAY);
  // Só recua enquanto o dia anterior for não útil; ao achar um dia útil, para
  // — aquele dia liquida a si mesmo, não este crédito.
  for (let i = 0; i < 30 && !isBusinessDay(cursor, holidays); i += 1) {
    dates.push(new Date(cursor));
    cursor.setTime(cursor.getTime() - MS_PER_DAY);
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

// ─── Valor líquido esperado da locação ──────────────────────────────────────

/** Componentes do líquido repassado, como definidos pelo cliente. */
export interface LeaseNetComponents {
  /** Valor da locação bruta (CR). */
  gross_amount: number;
  /** Restituição do IPTU (CR). */
  property_tax_refund?: number | null;
  /** Desconto do IRRF na fonte (DB). */
  income_tax_withheld?: number | null;
  /** Comissão da imobiliária (DB). */
  agency_commission?: number | null;
}

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** Líquido = Bruto + IPTU − IRRF − Comissão. */
export function computeLeaseNetAmount(components: LeaseNetComponents): number {
  return round2(
    components.gross_amount
      + (components.property_tax_refund ?? 0)
      - (components.income_tax_withheld ?? 0)
      - (components.agency_commission ?? 0),
  );
}

/**
 * Tolerância da comparação de valores, em reais.
 *
 * O líquido é reconstruído a partir de percentuais (comissão, IRRF), então
 * arredondamento de centavo entre o cálculo e o que o banco creditou é normal.
 */
export const AMOUNT_TOLERANCE = 0.02;

export function amountMatches(expected: number, credited: number, tolerance = AMOUNT_TOLERANCE): boolean {
  return Math.abs(round2(expected) - round2(credited)) <= tolerance;
}

/** Uma locação candidata devolvida pela busca. */
export interface CreditCandidate {
  lease_id: string;
  property_title: string;
  tenant_name: string;
  agency_name: string;
  /** Dia de vencimento do aluguel, do IPTU e do condomínio. */
  rent_due_day: number;
  tax_due_day: number | null;
  condo_due_day: number | null;
  /** Líquido calculado pela fórmula acima. */
  net_amount: number;
  gross_amount: number;
  property_tax_refund: number;
  income_tax_withheld: number;
  agency_commission: number;
  /** Vencimento do aluguel que foi deslocado para a data do crédito. */
  rent_due_date: string;
  /** Lançamentos pendentes que serão concluídos ao confirmar. */
  pending_transaction_ids: string[];
  /** `true` quando o líquido bate com o valor do crédito informado. */
  amount_matches: boolean;
}

export interface CreditReconciliationSearchInput {
  credit_date: string;
  credited_amount: number;
  financial_institution_id: string;
  agency_ids: string[];
}

export interface CompleteCreditReconciliationInput extends CreditReconciliationSearchInput {
  lease_id: string;
}

export interface CompleteCreditReconciliationResult {
  lease_id: string;
  updated_transactions: number;
}

/**
 * Ordena os candidatos: quem bate no valor primeiro (é quase sempre a
 * resposta), depois por imobiliária e imóvel, para uma lista estável.
 */
export function sortCandidates(candidates: CreditCandidate[]): CreditCandidate[] {
  return [...candidates].sort(
    (a, b) =>
      Number(b.amount_matches) - Number(a.amount_matches)
      || a.agency_name.localeCompare(b.agency_name, 'pt-BR')
      || a.property_title.localeCompare(b.property_title, 'pt-BR'),
  );
}
