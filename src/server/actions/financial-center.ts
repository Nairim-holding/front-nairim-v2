'use server';

import { financialCenterUseCases } from '@/infra/factories/financial-center-factory';
import {
  createFinancialCenterSchema,
  quickCreateFinancialCenterSchema,
  updateFinancialCenterSchema,
} from '@/shared/validators/financial-center';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type { Center, PaginatedCenters } from '@/core/entities/financial-center';
import {
  getCenterByIdData,
  getCenterFiltersData,
  listFinancialCentersData,
} from '@/server/queries/financial-center';

/**
 * Server Actions do módulo Centros de Custo.
 * Substituem os endpoints de `/financial-center`.
 * Guarda: `withTenant`. Camada: server. Origem: CenterController.
 */

export async function createFinancialCenterAction(input: Record<string, unknown>): Promise<ActionResult<Center>> {
  return runAction(async () => {
    const data = createFinancialCenterSchema.parse(input);
    return withTenant(() => financialCenterUseCases.create.execute(data));
  });
}

export async function updateFinancialCenterAction(id: string, input: Record<string, unknown>): Promise<ActionResult<Center>> {
  return runAction(async () => {
    const data = updateFinancialCenterSchema.parse(input);
    return withTenant(() => financialCenterUseCases.update.execute(id, data));
  });
}

export async function deleteFinancialCenterAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withTenant(() => financialCenterUseCases.remove.execute(id));
    return null;
  });
}

export async function restoreFinancialCenterAction(id: string): Promise<ActionResult<Center>> {
  return runAction(() => withTenant(() => financialCenterUseCases.restore.execute(id)));
}

export async function quickCreateFinancialCenterAction(input: Record<string, unknown>): Promise<ActionResult<Center>> {
  return runAction(async () => {
    const data = quickCreateFinancialCenterSchema.parse(input);
    return withTenant(() => financialCenterUseCases.quickCreate.execute(data));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listCentersAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedCenters>> {
  return runAction(() => listFinancialCentersData(raw));
}

export async function getCenterByIdAction(id: string): Promise<ActionResult<Center>> {
  return runAction(() => getCenterByIdData(id));
}

export async function getCenterFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getCenterFiltersData(raw));
}