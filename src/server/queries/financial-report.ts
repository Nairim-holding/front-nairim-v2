import 'server-only';
import { financialReportUseCases } from '@/infra/factories/financial-report-factory';
import { withPermission } from '@/infra/auth/session';
import { reportParamsSchema, groupBySchema, dfcGroupBySchema } from '@/shared/validators/financial-report';
import type {
  DemonstrativoResult,
  ExtratoResult,
  GroupedReportResult,
  IncomeExpenseResult,
  ReportParams,
} from '@/core/entities/financial-report';

/**
 * Queries (leitura) do módulo Relatórios Financeiros — para Client Components.
 * Guarda: `withPermission('financial-reports', 'view')`.
 * Camada: server. Origem: ReportController.ts.
 *
 * ⚠️ Nome de arquivo deliberadamente SINGULAR — já existe
 * `server/queries/financial-reports.ts` de outro recurso (agregações do
 * Dashboard). Ver core/entities/financial-report.ts.
 */

const MULTI_SELECT_FIELDS = ['financial_institution_id', 'card_id', 'category_id', 'subcategory_id', 'center_id', 'supplier_id'];

/**
 * Extrai `ReportParams` do `raw` vindo do front — multi-seleção chega como
 * chave repetida (array), vírgula (`category_id=a,b`), ou o padrão
 * `filter[campo]`. `status='all'` é tratado como ausente (sem filtro).
 */
function parseReportParams(raw: Record<string, unknown>): ReportParams {
  const rawStatus = typeof raw.status === 'string' && raw.status !== 'all' ? raw.status : undefined;

  const { startDate, endDate, regime, status, type } = reportParamsSchema.parse({
    startDate: raw.startDate,
    endDate: raw.endDate,
    regime: raw.regime,
    status: rawStatus,
    type: raw.type,
  });

  const filters: Record<string, string[]> = {};

  const addValues = (field: string, value: unknown) => {
    const values = (Array.isArray(value) ? value : [value])
      .filter((v): v is string => typeof v === 'string')
      .flatMap((v) => v.split(','))
      .map((v) => v.trim())
      .filter((v) => v !== '');
    if (values.length > 0) filters[field] = [...(filters[field] ?? []), ...values];
  };

  Object.entries(raw).forEach(([key, value]) => {
    const filterMatch = key.match(/^filter\[(.+)\]$/);
    const field = filterMatch ? filterMatch[1] : key;
    if (MULTI_SELECT_FIELDS.includes(field)) addValues(field, value);
  });

  return { startDate, endDate, regime: regime ?? 'caixa', status, type, filters };
}

export async function getGroupedReportData(raw: Record<string, unknown>): Promise<GroupedReportResult> {
  const params = parseReportParams(raw);
  const groupBy = groupBySchema.parse(raw.groupBy);
  return withPermission('financial-reports', 'view', () => financialReportUseCases.getGrouped.execute(params, groupBy));
}

export async function getExtratoReportData(raw: Record<string, unknown>): Promise<ExtratoResult> {
  const params = parseReportParams(raw);
  return withPermission('financial-reports', 'view', () => financialReportUseCases.getExtrato.execute(params));
}

export async function getIncomeExpenseReportData(raw: Record<string, unknown>): Promise<IncomeExpenseResult> {
  const params = parseReportParams(raw);
  return withPermission('financial-reports', 'view', () => financialReportUseCases.getIncomeExpense.execute(params));
}

export async function getDemonstrativoReportData(raw: Record<string, unknown>): Promise<DemonstrativoResult> {
  const params = parseReportParams(raw);
  const groupBy = dfcGroupBySchema.parse(raw.groupBy);
  return withPermission('financial-reports', 'view', () => financialReportUseCases.getDemonstrativo.execute(params, groupBy));
}
