import 'server-only';
import { planningUseCases } from '@/infra/factories/planning-factory';
import { withTenant } from '@/infra/auth/session';
import { planningDashboardQuerySchema } from '@/shared/validators/planning';
import type {
  PlanningDashboardFilters,
  PlanningDashboardResponse,
} from '@/core/entities/planning';

/**
 * Queries (leitura) do módulo Planejamento — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: PlanningController (GETs).
 */

export async function getPlanningDashboardData(
  raw: Record<string, unknown>,
): Promise<PlanningDashboardResponse> {
  const { startDate, endDate } = planningDashboardQuerySchema.parse(raw);

  // Mesma convenção do botão de Filtro de Lançamentos: chave repetida =
  // seleção múltipla (sem prefixo `filter[...]`).
  const FILTER_FIELDS = [
    'category_id',
    'subcategory_id',
    'financial_institution_id',
    'card_id',
    'center_id',
    'supplier_id',
    'description',
  ] as const;

  const filters: PlanningDashboardFilters = {};
  for (const field of FILTER_FIELDS) {
    const value = raw[field];
    if (value === undefined) continue;
    const values = (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
    if (values.length > 0) filters[field] = values;
  }

  return withTenant(() => planningUseCases.getDashboard.execute(startDate, endDate, filters));
}