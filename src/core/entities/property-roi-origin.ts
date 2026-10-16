import { computePropertyRoiUnrounded, type RoiLineKey, type RoiPropertyInput, type RoiPropertyRow, type RoiReport, type RoiWarning } from './property-roi';

/** Valores numéricos do relatório que podem ser inspecionados. */
export const ROI_METRIC_KEYS = [
  'purchaseValue', 'itbi', 'registry', 'initialRenovation', 'totalInvestment',
  'monthlyRent', 'grossAnnualRevenue', 'vacancyMonths', 'vacancyAmount', 'netAnnualRevenue',
  'iptuAnnual', 'insuranceAnnual', 'commissionAnnual', 'maintenanceAnnual', 'totalAnnualExpenses',
  'annualCashFlow', 'roi', 'capRate', 'paybackYears', 'paybackMonths', 'monthsLeased', 'rentReceived',
] as const;
export type RoiMetricKey = (typeof ROI_METRIC_KEYS)[number];
export type RoiOriginUnit = 'currency' | 'percent' | 'years' | 'months' | 'number';

export const ROI_METRIC_DEFINITIONS: Record<RoiMetricKey, { label: string; unit: RoiOriginUnit; formula: string }> = {
  purchaseValue: { label: 'Valor de compra', unit: 'currency', formula: 'Valor de compra do cadastro mais recente do imóvel.' },
  itbi: { label: 'ITBI', unit: 'currency', formula: 'Soma dos lançamentos realizados de ITBI no Centro de Custo, em todo o histórico.' },
  registry: { label: 'Cartório e escritura', unit: 'currency', formula: 'Soma dos lançamentos realizados de cartório e escritura no Centro de Custo, em todo o histórico.' },
  initialRenovation: { label: 'Reforma inicial', unit: 'currency', formula: 'Soma da manutenção realizada até um ano após a data de compra, em todo o histórico.' },
  totalInvestment: { label: 'Investimento inicial', unit: 'currency', formula: 'Valor de compra + ITBI + cartório e escritura + reforma inicial.' },
  monthlyRent: { label: 'Aluguel mensal médio', unit: 'currency', formula: 'Aluguéis realizados em todo o histórico ÷ meses locados. Sem meses locados, o valor é zero.' },
  grossAnnualRevenue: { label: 'Receita bruta anual', unit: 'currency', formula: 'Aluguel mensal médio × 12.' },
  vacancyMonths: { label: 'Vacância prevista por ano', unit: 'months', formula: 'Meses de vacância previstos por ano no cadastro mais recente do imóvel; sem previsão, zero.' },
  vacancyAmount: { label: 'Vacância anual', unit: 'currency', formula: 'Aluguel mensal médio × meses de vacância previstos por ano.' },
  netAnnualRevenue: { label: 'Receita líquida anual', unit: 'currency', formula: 'Receita bruta anual − vacância anual.' },
  iptuAnnual: { label: 'IPTU anual', unit: 'currency', formula: 'IPTU realizado no período × (12 ÷ meses do período de referência).' },
  insuranceAnnual: { label: 'Seguro anual', unit: 'currency', formula: 'Seguro realizado no período × (12 ÷ meses do período de referência).' },
  commissionAnnual: { label: 'Administração anual', unit: 'currency', formula: 'Administração realizada no período × (12 ÷ meses do período de referência).' },
  maintenanceAnnual: { label: 'Manutenção periódica anual', unit: 'currency', formula: 'Manutenção realizada após o primeiro ano da compra e dentro do período × (12 ÷ meses do período). Sem data de compra, considera toda a manutenção do período.' },
  totalAnnualExpenses: { label: 'Despesas anuais', unit: 'currency', formula: 'IPTU anual + seguro anual + administração anual + manutenção periódica anual.' },
  annualCashFlow: { label: 'Fluxo de caixa anual', unit: 'currency', formula: 'Receita líquida anual − despesas anuais.' },
  roi: { label: 'ROI anual', unit: 'percent', formula: 'Fluxo de caixa anual ÷ investimento inicial. Sem investimento positivo, o indicador não é calculado.' },
  capRate: { label: 'Cap Rate', unit: 'percent', formula: 'Fluxo de caixa anual ÷ valor de compra. Sem valor de compra positivo, o indicador não é calculado.' },
  paybackYears: { label: 'Payback em anos', unit: 'years', formula: 'Investimento inicial ÷ fluxo de caixa anual. Exige investimento e fluxo positivos.' },
  paybackMonths: { label: 'Payback em meses', unit: 'months', formula: '(Investimento inicial ÷ fluxo de caixa anual) × 12. Exige investimento e fluxo positivos.' },
  monthsLeased: { label: 'Meses locados', unit: 'months', formula: 'Meses completos da união dos períodos de locação, limitados ao encerramento, cancelamento ou hoje. Períodos sobrepostos contam uma vez.' },
  rentReceived: { label: 'Aluguéis realizados', unit: 'currency', formula: 'Soma dos aluguéis realizados no Centro de Receita, em todo o histórico.' },
};

export interface RoiOriginComponent {
  key: string;
  label: string;
  value: number | null;
  unit: RoiOriginUnit;
}

export interface RoiTransactionOriginSource {
  kind: 'transaction';
  id: string;
  date: string;
  eventDate: string;
  description: string;
  amount: number;
  lineKeys: RoiLineKey[];
  category: { id: string; name: string };
  subcategory: { id: string; name: string } | null;
  center: { id: string; name: string } | null;
  institution: { id: string; name: string } | null;
}

export interface RoiPropertyOriginSource {
  kind: 'property';
  id: string;
  valueId: string | null;
  fields: Array<{
    key: 'purchaseValue' | 'purchaseDate' | 'vacancyMonths';
    label: string;
    value: number | string | null;
    unit: 'currency' | 'months' | 'date';
  }>;
}

export interface RoiLeaseOriginSource {
  kind: 'lease';
  id: string;
  contractNumber: string;
  start: string;
  end: string;
  canceledAt: string | null;
  consideredEnd: string;
}

export type RoiOriginSource = RoiTransactionOriginSource | RoiPropertyOriginSource | RoiLeaseOriginSource;

export interface RoiPropertyOrigin {
  propertyId: string;
  propertyTitle: string;
  value: number | null;
  formula: string;
  components: RoiOriginComponent[];
  sources: RoiOriginSource[];
  warnings: RoiWarning[];
}

export interface RoiOrigin {
  metric: RoiMetricKey;
  title: string;
  formula: string;
  value: number | null;
  unit: RoiOriginUnit;
  period: RoiReport['period'];
  properties: RoiPropertyOrigin[];
  warnings: string[];
}

/** Contexto interno: calculado juntamente com o relatório, jamais recebido do cliente. */
export interface RoiOriginContext {
  row: RoiPropertyRow;
  input: RoiPropertyInput;
  propertySource: RoiPropertyOriginSource;
  leases: RoiLeaseOriginSource[];
  entries: Record<'itbi' | 'registry' | 'initialRenovation' | 'rentReceived' | 'iptuAnnual' | 'insuranceAnnual' | 'commissionAnnual' | 'maintenanceAnnual', RoiTransactionOriginSource[]>;
}

const dependencies: Partial<Record<RoiMetricKey, RoiMetricKey[]>> = {
  totalInvestment: ['purchaseValue', 'itbi', 'registry', 'initialRenovation'],
  monthlyRent: ['rentReceived', 'monthsLeased'],
  grossAnnualRevenue: ['monthlyRent'],
  vacancyAmount: ['monthlyRent', 'vacancyMonths'],
  netAnnualRevenue: ['grossAnnualRevenue', 'vacancyAmount'],
  totalAnnualExpenses: ['iptuAnnual', 'insuranceAnnual', 'commissionAnnual', 'maintenanceAnnual'],
  annualCashFlow: ['netAnnualRevenue', 'totalAnnualExpenses'],
  roi: ['annualCashFlow', 'totalInvestment'],
  capRate: ['annualCashFlow', 'purchaseValue'],
  paybackYears: ['totalInvestment', 'annualCashFlow'],
  paybackMonths: ['paybackYears'],
};

function collectMetricKeys(metric: RoiMetricKey, target = new Set<RoiMetricKey>()): Set<RoiMetricKey> {
  target.add(metric);
  for (const key of dependencies[metric] ?? []) collectMetricKeys(key, target);
  return target;
}

function componentsFor(context: RoiOriginContext, metric: RoiMetricKey): RoiOriginComponent[] {
  const unrounded = { ...context.row, ...computePropertyRoiUnrounded(context.input) };
  const rawAnnual: Partial<Record<RoiMetricKey, keyof RoiPropertyInput>> = {
    iptuAnnual: 'iptu', insuranceAnnual: 'insurance', commissionAnnual: 'commission', maintenanceAnnual: 'periodicMaintenance',
  };
  const rawKey = rawAnnual[metric];
  if (rawKey) {
    return [
      { key: rawKey, label: 'Lançamentos realizados no período', value: context.input[rawKey], unit: 'currency' },
      { key: 'periodMonths', label: 'Meses do período de referência', value: context.input.periodMonths, unit: 'months' },
      { key: 'annualFactor', label: 'Fator de anualização (12 ÷ meses do período)', value: context.input.periodMonths > 0 ? 12 / context.input.periodMonths : 0, unit: 'number' },
    ];
  }
  return (dependencies[metric] ?? [metric]).map((key) => ({
    key, label: ROI_METRIC_DEFINITIONS[key].label, value: unrounded[key], unit: ROI_METRIC_DEFINITIONS[key].unit,
  }));
}

function originForProperty(context: RoiOriginContext, metric: RoiMetricKey): RoiPropertyOrigin {
  const relevant = collectMetricKeys(metric);
  const sources: RoiOriginSource[] = [];
  const propertyFields = context.propertySource.fields.filter((field) =>
    (field.key === 'purchaseValue' && relevant.has('purchaseValue'))
    || (field.key === 'vacancyMonths' && relevant.has('vacancyMonths'))
    || (field.key === 'purchaseDate' && (relevant.has('initialRenovation') || relevant.has('maintenanceAnnual'))),
  );
  if (propertyFields.length > 0) sources.push({ ...context.propertySource, fields: propertyFields });
  const transactions = new Map<string, RoiTransactionOriginSource>();
  for (const [key, entries] of Object.entries(context.entries)) {
    if (!relevant.has(key as RoiMetricKey)) continue;
    for (const source of entries) {
      const existing = transactions.get(source.id);
      transactions.set(source.id, existing
        ? { ...existing, lineKeys: [...new Set([...existing.lineKeys, ...source.lineKeys])] }
        : { ...source });
    }
  }
  sources.push(...[...transactions.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)));
  if (relevant.has('monthsLeased')) sources.push(...context.leases);
  return {
    propertyId: context.row.propertyId, propertyTitle: context.row.propertyTitle,
    value: context.row[metric], formula: ROI_METRIC_DEFINITIONS[metric].formula,
    components: componentsFor(context, metric), sources, warnings: context.row.warnings,
  };
}

/** Mesmo agregado do rodapé: somas dos valores exibidos e razões das somas. */
export function aggregateRoiMetric(rows: RoiPropertyRow[], metric: RoiMetricKey): number | null {
  const sum = (key: RoiMetricKey) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
  const investment = sum('totalInvestment');
  const cashFlow = sum('annualCashFlow');
  if (metric === 'roi') return investment > 0 ? cashFlow / investment : null;
  if (metric === 'capRate') return sum('purchaseValue') > 0 ? cashFlow / sum('purchaseValue') : null;
  if (metric === 'paybackYears' || metric === 'paybackMonths') {
    return investment > 0 && cashFlow > 0 ? investment / cashFlow * (metric === 'paybackMonths' ? 12 : 1) : null;
  }
  return sum(metric);
}

export function buildRoiOrigin(report: RoiReport, contexts: RoiOriginContext[], metric: RoiMetricKey): RoiOrigin {
  const definition = ROI_METRIC_DEFINITIONS[metric];
  const portfolio = contexts.length !== 1;
  const ratio = ['roi', 'capRate', 'paybackYears', 'paybackMonths'].includes(metric);
  return {
    metric, title: definition.label, unit: definition.unit,
    formula: portfolio
      ? ratio ? `Indicador da carteira calculado sobre as somas dos imóveis selecionados. ${definition.formula}` : `Soma de ${definition.label.toLocaleLowerCase('pt-BR')} dos imóveis selecionados. ${definition.formula}`
      : definition.formula,
    value: portfolio ? aggregateRoiMetric(report.rows, metric) : contexts[0].row[metric],
    period: report.period,
    properties: contexts.map((context) => originForProperty(context, metric)),
    warnings: [
      ...(report.usingSuggestedLines ? ['As categorias e subcategorias foram sugeridas automaticamente; a configuração ainda não foi salva.'] : []),
      ...(report.missingLines.length > 0 ? ['Há linhas do ROI sem categoria configurada; os lançamentos dessas linhas não entram no cálculo.'] : []),
    ],
  };
}
