/**
 * ROI por imóvel — regras da planilha `Calculo_ROI_Imoveis_Completo.xlsx`
 * (doc de correções de 13/10/2026).
 *
 * Aba "Fluxo de Caixa e ROI":
 *  1. Investimento inicial = compra + ITBI + cartório/registro + reformas do 1º ano.
 *  2. Receita = aluguel mensal médio × 12 − vacância prevista (em meses por ano).
 *  3. Despesas anuais = IPTU + seguro + taxa de administração + manutenção periódica.
 *  4. Fluxo = receita líquida − despesas; ROI = fluxo ÷ investimento;
 *     Cap Rate = fluxo ÷ valor de compra; Payback = investimento ÷ fluxo.
 * Aba "Cenários de Valorização": venda futura com juros compostos, corretagem e IR.
 *
 * Camada: core (regra pura, sem I/O).
 */

// ─── Linhas configuráveis (categoria/subcategoria do Financeiro) ─────────────

export const ROI_LINE_KEYS = ['itbi', 'registry', 'maintenance', 'rent', 'iptu', 'insurance', 'commission'] as const;
export type RoiLineKey = (typeof ROI_LINE_KEYS)[number];

// `type` (não `interface`): é gravado em coluna JSON e precisa ser atribuível a um objeto JSON.
export type RoiLineSetting = {
  category_id: string | null;
  subcategory_id: string | null;
};

export type RoiLines = Record<RoiLineKey, RoiLineSetting>;

export interface RoiLineDefinition {
  key: RoiLineKey;
  label: string;
  /** De qual centro do imóvel o lançamento precisa ser: receita (crédito) ou custo (débito). */
  side: 'income' | 'cost';
  /** Nomes da planilha, usados para sugerir a configuração. */
  categoryName: string;
  subcategoryName: string;
  /** Trechos (sem acento, minúsculos) que identificam categoria e subcategoria pelo nome. */
  categoryKeyword: string;
  subcategoryKeywords: string[];
  /** De onde o dado vem, como descrito na planilha. */
  source: string;
}

export const ROI_LINE_DEFINITIONS: RoiLineDefinition[] = [
  { key: 'itbi', label: 'Impostos (ITBI)', side: 'cost', categoryName: 'Impostos', subcategoryName: 'ITBI', categoryKeyword: 'imposto', subcategoryKeywords: ['itbi'],
    source: 'Lançamentos da categoria Impostos, subcategoria ITBI, do Centro de Custo do imóvel, em qualquer data.' },
  { key: 'registry', label: 'Custos de Cartório e Escritura', side: 'cost', categoryName: 'Impostos', subcategoryName: 'Registro de Imóveis', categoryKeyword: 'imposto', subcategoryKeywords: ['registro de imove', 'cartorio', 'escritura'],
    source: 'Lançamentos da categoria Impostos, subcategoria Registro de Imóveis, do Centro de Custo do imóvel, em qualquer data.' },
  { key: 'maintenance', label: 'Manutenção de Imóveis', side: 'cost', categoryName: 'Despesas Variáveis', subcategoryName: 'Manutenção de Imóveis', categoryKeyword: 'despesas variave', subcategoryKeywords: ['manutencao'],
    source: 'Lançamentos da categoria Despesas Variáveis, subcategoria Manutenção de Imóveis, do Centro de Custo do imóvel. Até 1 ano após a compra contam como reforma inicial; depois disso, como manutenção periódica.' },
  { key: 'rent', label: 'Aluguel', side: 'income', categoryName: 'Receitas', subcategoryName: 'Aluguel', categoryKeyword: 'receita', subcategoryKeywords: ['aluguel', 'alugueis'],
    source: 'Lançamentos da categoria Receitas, subcategoria Aluguel, do Centro de Receita do imóvel, em qualquer data.' },
  { key: 'iptu', label: 'IPTU Anual', side: 'cost', categoryName: 'Impostos', subcategoryName: 'IPTU', categoryKeyword: 'imposto', subcategoryKeywords: ['iptu'],
    source: 'Lançamentos da categoria Impostos, subcategoria IPTU, do Centro de Custo do imóvel, no período de referência.' },
  { key: 'insurance', label: 'Seguro Incêndio/Imóvel Anual', side: 'cost', categoryName: 'Despesas Variáveis', subcategoryName: 'Seguros (Imóvel / Incêndios)', categoryKeyword: 'despesas variave', subcategoryKeywords: ['seguro'],
    source: 'Lançamentos da categoria Despesas Variáveis, subcategoria Seguros (Imóvel / Incêndios), do Centro de Custo do imóvel, no período de referência.' },
  { key: 'commission', label: 'Taxa de Administração da Imobiliária', side: 'cost', categoryName: 'Despesas Fixas', subcategoryName: 'Comissões Imobiliárias', categoryKeyword: 'despesas fixa', subcategoryKeywords: ['comiss'],
    source: 'Lançamentos da categoria Despesas Fixas, subcategoria Comissões Imobiliárias, do Centro de Custo do imóvel, no período de referência.' },
];

export function emptyRoiLines(): RoiLines {
  return Object.fromEntries(ROI_LINE_KEYS.map((key) => [key, { category_id: null, subcategory_id: null }])) as RoiLines;
}

const normalizeName = (value: string): string => value
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface RoiCategoryOption {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  subcategories: Array<{ id: string; name: string }>;
}

/**
 * Sugere a configuração pelos nomes da planilha. Só preenche a linha quando
 * há exatamente uma subcategoria candidata — nome ambíguo fica para o usuário.
 */
export function suggestRoiLines(categories: RoiCategoryOption[]): RoiLines {
  const lines = emptyRoiLines();
  for (const definition of ROI_LINE_DEFINITIONS) {
    const type = definition.side === 'income' ? 'INCOME' : 'EXPENSE';
    const matches = categories
      .filter((category) => category.type === type && normalizeName(category.name).includes(definition.categoryKeyword))
      .flatMap((category) => category.subcategories
        .filter((sub) => definition.subcategoryKeywords.some((keyword) => normalizeName(sub.name).includes(keyword)))
        .map((sub) => ({ category_id: category.id, subcategory_id: sub.id })));
    if (matches.length === 1) lines[definition.key] = matches[0];
  }
  return lines;
}

/** Normaliza o que veio do banco/da tela para o formato completo, descartando chaves estranhas. */
export function normalizeRoiLines(raw: unknown): RoiLines {
  const lines = emptyRoiLines();
  if (!raw || typeof raw !== 'object') return lines;
  for (const key of ROI_LINE_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (!value || typeof value !== 'object') continue;
    const { category_id, subcategory_id } = value as Record<string, unknown>;
    const categoryId = typeof category_id === 'string' && category_id.trim() ? category_id : null;
    lines[key] = {
      category_id: categoryId,
      subcategory_id: categoryId && typeof subcategory_id === 'string' && subcategory_id.trim() ? subcategory_id : null,
    };
  }
  return lines;
}

export const missingRoiLines = (lines: RoiLines): RoiLineKey[] => ROI_LINE_KEYS.filter((key) => !lines[key].category_id);

// ─── Datas ───────────────────────────────────────────────────────────────────

const parseIso = (iso: string): Date => new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
const toIso = (date: Date): string => date.toISOString().slice(0, 10);

function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

/** Meses inteiros entre duas datas (o dia do mês final precisa alcançar o inicial). */
function wholeMonths(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return to.getUTCDate() >= from.getUTCDate() ? months : months - 1;
}

/**
 * Tamanho do período de referência em meses (as duas datas inclusive).
 * 14/10/2025 a 13/10/2026 = 12 meses; os dias que sobram entram como fração de 30.
 */
export function referencePeriodMonths(fromIso: string, toIso_: string): number {
  const from = parseIso(fromIso);
  const end = parseIso(toIso_);
  end.setUTCDate(end.getUTCDate() + 1);
  const months = wholeMonths(from, end);
  const anchor = new Date(from.getTime());
  anchor.setUTCMonth(anchor.getUTCMonth() + months);
  const remainingDays = Math.round((end.getTime() - anchor.getTime()) / 86_400_000);
  return Math.max(months + remainingDays / 30, 0);
}

export interface RoiLeasePeriod {
  start: string;
  end: string;
  canceledAt: string | null;
}

/**
 * Meses em que o imóvel ficou locado até hoje: união dos contratos (um mês
 * coberto por dois contratos conta uma vez), cada um limitado ao fim, ao
 * cancelamento ou a hoje — o que vier primeiro.
 */
export function leasedMonths(leases: RoiLeasePeriod[], todayIso: string): number {
  const today = parseIso(todayIso);
  const intervals = leases
    .map((lease) => {
      const start = parseIso(lease.start);
      let end = parseIso(lease.end);
      if (lease.canceledAt && parseIso(lease.canceledAt) < end) end = parseIso(lease.canceledAt);
      if (today < end) end = today;
      return { start, end };
    })
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let total = 0;
  let current: { start: Date; end: Date } | null = null;
  for (const interval of intervals) {
    if (current && interval.start <= current.end) {
      if (interval.end > current.end) current.end = interval.end;
      continue;
    }
    if (current) total += wholeMonths(current.start, current.end);
    current = { ...interval };
  }
  if (current) total += wholeMonths(current.start, current.end);
  return total;
}

export interface RoiDatedAmount {
  date: string;
  amount: number;
}

/** Limite inclusivo da reforma inicial, compartilhado com a origem dos valores. */
export function maintenanceCutoffDate(purchaseDateIso: string | null): string | null {
  return purchaseDateIso ? toIso(addYears(parseIso(purchaseDateIso), 1)) : null;
}

/**
 * Divide a manutenção em reforma inicial (até 1 ano após a compra, em qualquer
 * data) e manutenção periódica (depois disso, dentro do período de referência).
 * Sem data de compra não há como separar: tudo do período conta como periódica.
 */
export function splitMaintenance(
  entries: RoiDatedAmount[], purchaseDateIso: string | null, period: { from: string; to: string },
): { initial: number; periodic: number } {
  const cutoff = maintenanceCutoffDate(purchaseDateIso);
  let initial = 0;
  let periodic = 0;
  for (const entry of entries) {
    const date = entry.date.slice(0, 10);
    if (cutoff && date <= cutoff) initial += entry.amount;
    else if (date >= period.from && date <= period.to) periodic += entry.amount;
  }
  return { initial, periodic };
}

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export interface RoiPropertyInput {
  purchaseValue: number | null;
  /** Previsão de meses de vacância por ano (cadastro do imóvel). */
  vacancyMonths: number | null;
  /** Meses em que o imóvel ficou locado. */
  monthsLeased: number;
  itbi: number;
  registry: number;
  /** Manutenção até 1 ano após a compra. */
  initialRenovation: number;
  /** Aluguéis recebidos em qualquer data. */
  rentReceived: number;
  /** Despesas dentro do período de referência (ainda não anualizadas). */
  iptu: number;
  insurance: number;
  commission: number;
  periodicMaintenance: number;
  /** Tamanho do período de referência, em meses. */
  periodMonths: number;
}

export interface RoiPropertyResult {
  purchaseValue: number;
  itbi: number;
  registry: number;
  initialRenovation: number;
  totalInvestment: number;

  monthlyRent: number;
  grossAnnualRevenue: number;
  vacancyMonths: number;
  vacancyAmount: number;
  netAnnualRevenue: number;

  iptuAnnual: number;
  insuranceAnnual: number;
  commissionAnnual: number;
  maintenanceAnnual: number;
  totalAnnualExpenses: number;

  annualCashFlow: number;
  /** Indicadores ficam `null` quando o divisor não existe (sem investimento, fluxo ≤ 0…). */
  roi: number | null;
  capRate: number | null;
  paybackYears: number | null;
  paybackMonths: number | null;
}

const money = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** Intermediários sem arredondamento, também usados na memória de cálculo. */
export function computePropertyRoiUnrounded(input: RoiPropertyInput): RoiPropertyResult {
  const purchaseValue = input.purchaseValue ?? 0;
  const totalInvestment = purchaseValue + input.itbi + input.registry + input.initialRenovation;

  const monthlyRent = input.monthsLeased > 0 ? input.rentReceived / input.monthsLeased : 0;
  const grossAnnualRevenue = monthlyRent * 12;
  const vacancyMonths = input.vacancyMonths ?? 0;
  const vacancyAmount = monthlyRent * vacancyMonths;
  const netAnnualRevenue = grossAnnualRevenue - vacancyAmount;

  // Despesas do período viram valor anual: 12 meses = fator 1; 24 meses = metade.
  const annualFactor = input.periodMonths > 0 ? 12 / input.periodMonths : 0;
  const iptuAnnual = input.iptu * annualFactor;
  const insuranceAnnual = input.insurance * annualFactor;
  const commissionAnnual = input.commission * annualFactor;
  const maintenanceAnnual = input.periodicMaintenance * annualFactor;
  const totalAnnualExpenses = iptuAnnual + insuranceAnnual + commissionAnnual + maintenanceAnnual;

  const annualCashFlow = netAnnualRevenue - totalAnnualExpenses;
  const paybackYears = totalInvestment > 0 && annualCashFlow > 0 ? totalInvestment / annualCashFlow : null;

  return {
    purchaseValue,
    itbi: input.itbi,
    registry: input.registry,
    initialRenovation: input.initialRenovation,
    totalInvestment,
    monthlyRent,
    grossAnnualRevenue,
    vacancyMonths,
    vacancyAmount,
    netAnnualRevenue,
    iptuAnnual,
    insuranceAnnual,
    commissionAnnual,
    maintenanceAnnual,
    totalAnnualExpenses,
    annualCashFlow,
    roi: totalInvestment > 0 ? annualCashFlow / totalInvestment : null,
    capRate: purchaseValue > 0 ? annualCashFlow / purchaseValue : null,
    paybackYears,
    paybackMonths: paybackYears === null ? null : paybackYears * 12,
  };
}

export function computePropertyRoi(input: RoiPropertyInput): RoiPropertyResult {
  const result = computePropertyRoiUnrounded(input);
  const currencyKeys = [
    'purchaseValue', 'itbi', 'registry', 'initialRenovation', 'totalInvestment', 'monthlyRent',
    'grossAnnualRevenue', 'vacancyAmount', 'netAnnualRevenue', 'iptuAnnual', 'insuranceAnnual',
    'commissionAnnual', 'maintenanceAnnual', 'totalAnnualExpenses', 'annualCashFlow',
  ] as const;
  for (const key of currencyKeys) result[key] = money(result[key]);
  return result;
}

// ─── Cenário de valorização e venda (aba 2 da planilha) ──────────────────────

export interface SaleScenarioInput {
  purchaseValue: number;
  totalInvestment: number;
  annualCashFlow: number;
  /** Anos até a venda. */
  years: number;
  /** Valorização anual esperada (0.06 = 6%). */
  appreciationRate: number;
  /** Corretagem sobre o preço de venda (padrão 6%). */
  brokerageRate?: number;
  /** IR sobre o ganho de capital (padrão 15%). */
  capitalGainsTaxRate?: number;
}

export interface SaleScenarioResult {
  projectedSalePrice: number;
  saleCost: number;
  grossProfit: number;
  capitalGainsTax: number;
  netProfit: number;
  /** (fluxo anual × anos + lucro líquido da venda) ÷ investimento inicial. */
  globalRoi: number | null;
}

export function computeSaleScenario(input: SaleScenarioInput): SaleScenarioResult {
  const brokerageRate = input.brokerageRate ?? 0.06;
  const taxRate = input.capitalGainsTaxRate ?? 0.15;
  const projectedSalePrice = input.purchaseValue * (1 + input.appreciationRate) ** input.years;
  const saleCost = projectedSalePrice * brokerageRate;
  const grossProfit = projectedSalePrice - saleCost - input.totalInvestment;
  const capitalGainsTax = grossProfit > 0 ? grossProfit * taxRate : 0;
  const netProfit = grossProfit - capitalGainsTax;
  return {
    projectedSalePrice: money(projectedSalePrice),
    saleCost: money(saleCost),
    grossProfit: money(grossProfit),
    capitalGainsTax: money(capitalGainsTax),
    netProfit: money(netProfit),
    globalRoi: input.totalInvestment > 0 ? (input.annualCashFlow * input.years + netProfit) / input.totalInvestment : null,
  };
}

// ─── Relatório ───────────────────────────────────────────────────────────────

export type RoiWarning =
  | 'NO_PURCHASE_VALUE'
  | 'NO_PURCHASE_DATE'
  | 'NO_INCOME_CENTER'
  | 'NO_COST_CENTER'
  | 'SHARED_INCOME_CENTER'
  | 'SHARED_COST_CENTER'
  | 'NEVER_LEASED';

export const ROI_WARNING_LABELS: Record<RoiWarning, string> = {
  NO_PURCHASE_VALUE: 'Sem valor de compra no cadastro do imóvel — ROI, Cap Rate e Payback não podem ser calculados.',
  NO_PURCHASE_DATE: 'Sem data de compra — não dá para separar a reforma inicial da manutenção periódica; toda a manutenção do período foi tratada como periódica.',
  NO_INCOME_CENTER: 'Imóvel sem Centro de Receita — os aluguéis não puderam ser localizados.',
  NO_COST_CENTER: 'Imóvel sem Centro de Custo — as despesas não puderam ser localizadas.',
  SHARED_INCOME_CENTER: 'O Centro de Receita é usado por mais de um imóvel — os aluguéis não foram atribuídos para não misturar imóveis.',
  SHARED_COST_CENTER: 'O Centro de Custo é usado por mais de um imóvel — as despesas não foram atribuídas para não misturar imóveis.',
  NEVER_LEASED: 'Nenhum período de locação encontrado — o aluguel mensal estimado ficou zerado.',
};

export interface RoiPropertyRow extends RoiPropertyResult {
  propertyId: string;
  propertyTitle: string;
  purchaseDate: string | null;
  monthsLeased: number;
  rentReceived: number;
  warnings: RoiWarning[];
}

export interface RoiReport {
  rows: RoiPropertyRow[];
  period: { from: string; to: string; months: number };
  /** Linhas do cálculo ainda sem categoria definida. */
  missingLines: RoiLineKey[];
  /** `true` quando nada foi salvo e o cálculo usou a sugestão automática pelos nomes. */
  usingSuggestedLines: boolean;
  availableProperties: Array<{ id: string; title: string }>;
}

export interface RoiSettingsView {
  lines: RoiLines;
  /** `false` enquanto a empresa não salvou a configuração (as linhas são só sugestão). */
  saved: boolean;
  categories: RoiCategoryOption[];
}
