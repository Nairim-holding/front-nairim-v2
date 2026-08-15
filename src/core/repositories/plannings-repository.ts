import type {
  Planning,
  PlanningDashboardFilters,
  PlanningDashboardResponse,
  UpsertPlanningData,
} from '@/core/entities/planning';

/**
 * Contrato de acesso a dados de Planejamento (Planning + PlanningMonth).
 * Implementacao Prisma: infra/repositories/prisma-plannings-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.planning.*` e `prisma.category.*` em
 * api-nairim-v2/src/services/PlanningService.ts.
 */
export interface PlanningsRepository {
  /** Cria ou atualiza o planejamento da combinação (category, subcategory) e
   * devolve com `monthly_values` ordenados por mês. Exige o par exclusivo —
   * mas não valida duplicidade (regra da camada de use-case).
   * O `company_id` é opcional: quando ausente, a extensão multi-tenant injeta
   * automaticamente nas leituras e no create. */
  upsert(
    data: UpsertPlanningData & { company_id?: string },
  ): Promise<Planning>;
  /** Soft-delete de um planejamento. Lança erro se não existir ativo. */
  remove(id: string): Promise<Planning>;
  /** Agregado do GET /planning/dashboard (saldos + categorias + subcategorias
   *  + planejado/realizado). */
  getDashboard(
    startDate: string,
    endDate: string,
    filters?: PlanningDashboardFilters,
  ): Promise<PlanningDashboardResponse>;
}