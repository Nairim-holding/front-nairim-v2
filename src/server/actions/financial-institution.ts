'use server';

import { financialInstitutionUseCases } from '@/infra/factories/financial-institution-factory';
import { createFinancialInstitutionSchema, quickCreateFinancialInstitutionSchema, updateFinancialInstitutionSchema } from '@/shared/validators/financial-institution';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withPermission, withPermissionInput } from '@/infra/auth/session';
import type {
  BalanceSummaryItem,
  FinancialInstitution,
  PaginatedFinancialInstitutions,
} from '@/core/entities/financial-institution';
import {
  listFinancialInstitutionsData,
  getFinancialInstitutionByIdData,
  getFinancialInstitutionFiltersData,
  getFinancialInstitutionBalanceSummaryData,
} from '@/server/queries/financial-institution';

/**
 * Server Actions do módulo Instituições Financeiras.
 * Substituem os endpoints de `/financial-institution`.
 * Guarda: `withTenant`. Camada: server. Origem: FinancialInstitutionController.
 */

export async function createFinancialInstitutionAction(input: Record<string, unknown>): Promise<ActionResult<FinancialInstitution>> {
  return runAction(async () => {
    const data = createFinancialInstitutionSchema.parse(input);
    return withPermissionInput('financial-institutions', 'create', input, () => financialInstitutionUseCases.create.execute(data));
  });
}

export async function updateFinancialInstitutionAction(id: string, input: Record<string, unknown>): Promise<ActionResult<FinancialInstitution>> {
  return runAction(async () => {
    const data = updateFinancialInstitutionSchema.parse(input);
    return withPermissionInput('financial-institutions', 'edit', input, () => financialInstitutionUseCases.update.execute(id, data));
  });
}

export async function deleteFinancialInstitutionAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withPermission('financial-institutions', 'delete', () => financialInstitutionUseCases.remove.execute(id));
    return null;
  });
}

export async function restoreFinancialInstitutionAction(id: string): Promise<ActionResult<FinancialInstitution>> {
  return runAction(() => withPermission('financial-institutions', 'edit', () => financialInstitutionUseCases.restore.execute(id)));
}

export async function quickCreateFinancialInstitutionAction(input: Record<string, unknown>): Promise<ActionResult<FinancialInstitution>> {
  return runAction(async () => {
    const data = quickCreateFinancialInstitutionSchema.parse(input);
    return withPermissionInput('financial-institutions', 'create', input, () => financialInstitutionUseCases.quickCreate.execute(data));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listFinancialInstitutionsAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedFinancialInstitutions>> {
  return runAction(() => listFinancialInstitutionsData(raw));
}

export async function getFinancialInstitutionByIdAction(id: string): Promise<ActionResult<FinancialInstitution>> {
  return runAction(() => getFinancialInstitutionByIdData(id));
}

export async function getFinancialInstitutionFiltersAction(): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getFinancialInstitutionFiltersData());
}

export async function getFinancialInstitutionBalanceSummaryAction(): Promise<ActionResult<BalanceSummaryItem[]>> {
  return runAction(() => getFinancialInstitutionBalanceSummaryData());
}
