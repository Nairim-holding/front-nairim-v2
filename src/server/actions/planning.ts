'use server';

import { planningUseCases } from '@/infra/factories/planning-factory';
import { planningUpsertSchema } from '@/shared/validators/planning';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withPermission, withPermissionInput } from '@/infra/auth/session';
import { getPlanningDashboardData } from '@/server/queries/planning';
import type { Planning, PlanningDashboardResponse } from '@/core/entities/planning';

/**
 * Server Actions do módulo Planejamento.
 * Substituem os endpoints de `/planning`.
 * Guarda: `withTenant`. Camada: server. Origem: PlanningController.
 */

export async function upsertPlanningAction(
  input: Record<string, unknown>,
): Promise<ActionResult<Planning>> {
  return runAction(async () => {
    const data = planningUpsertSchema.parse(input);
    const payload = {
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? undefined,
      type: data.type,
      default_amount: data.default_amount ?? undefined,
      monthly_values: data.monthly_values ?? [],
    };
    return withPermissionInput('planning', 'edit', input, () => planningUseCases.upsert.execute(payload));
  });
}

export async function deletePlanningAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withPermission('planning', 'delete', () => planningUseCases.remove.execute(id));
    return null;
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function getPlanningDashboardAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<PlanningDashboardResponse>> {
  return runAction(() => getPlanningDashboardData(raw));
}
