import 'server-only';
import { investmentUseCases } from '@/infra/factories/investment-factory';
import { withTenant } from '@/infra/auth/session';
import { investmentDashboardQuerySchema } from '@/shared/validators/investment';
import type {
  Investment,
  InvestmentDashboardFilters,
  InvestmentDashboardResponse,
  InvestmentSettings,
} from '@/core/entities/investment';

/**
 * Queries (leitura) do módulo Investimentos — para Server Components.
 * Guarda: `withTenant`. Camada: server.
 */

/** Mesma convenção do botão Filtro das demais telas: chave repetida = multi-seleção. */
const FILTER_FIELDS = [
  'financial_institution_id',
  'partition',
  'product_type',
  'issuer',
  'product',
  'is_liquidated',
  'maturity_date',
  'application_date',
] as const;

export function normalizeInvestmentFilterValues(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value])
    .map((item) => item !== null && typeof item === 'object' ? JSON.stringify(item) : String(item))
    .filter(Boolean);
}

export async function getInvestmentDashboardData(
  raw: Record<string, unknown>,
): Promise<InvestmentDashboardResponse> {
  const { startMonth, endMonth } = investmentDashboardQuerySchema.parse(raw);

  const filters: InvestmentDashboardFilters = {};
  for (const field of FILTER_FIELDS) {
    const value = raw[field];
    if (value === undefined) continue;
    const values = normalizeInvestmentFilterValues(value);
    if (values.length > 0) filters[field] = values;
  }

  return withTenant(() => investmentUseCases.getDashboard.execute({ startMonth, endMonth, filters }));
}

export async function listInvestmentsData(): Promise<Investment[]> {
  return withTenant(() => investmentUseCases.list.execute());
}

export async function getInvestmentFiltersData(): Promise<Record<string, unknown>> {
  return withTenant(() => investmentUseCases.getFilters.execute());
}

export async function getInvestmentSettingsData(): Promise<InvestmentSettings> {
  return withTenant(() => investmentUseCases.getSettings.execute());
}
