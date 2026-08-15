'use server';

import { financialSubcategoryUseCases } from '@/infra/factories/financial-subcategory-factory';
import {
  createFinancialSubcategorySchema,
  quickCreateFinancialSubcategorySchema,
  updateFinancialSubcategorySchema,
} from '@/shared/validators/financial-subcategory';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type { PaginatedSubcategories, Subcategory } from '@/core/entities/subcategory';
import {
  getSubcategoryByIdData,
  getSubcategoryFiltersData,
  listFinancialSubcategoriesData,
} from '@/server/queries/financial-subcategory';

/**
 * Server Actions do módulo Subcategorias Financeiras.
 * Substituem os endpoints de `/financial-subcategory`.
 * Guarda: `withTenant`. Camada: server. Origem: SubcategoryController.
 */

export async function createFinancialSubcategoryAction(input: Record<string, unknown>): Promise<ActionResult<Subcategory>> {
  return runAction(async () => {
    const data = createFinancialSubcategorySchema.parse(input);
    return withTenant(() => financialSubcategoryUseCases.create.execute(data));
  });
}

export async function updateFinancialSubcategoryAction(id: string, input: Record<string, unknown>): Promise<ActionResult<Subcategory>> {
  return runAction(async () => {
    const data = updateFinancialSubcategorySchema.parse(input);
    return withTenant(() => financialSubcategoryUseCases.update.execute(id, data));
  });
}

export async function deleteFinancialSubcategoryAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withTenant(() => financialSubcategoryUseCases.remove.execute(id));
    return null;
  });
}

export async function restoreFinancialSubcategoryAction(id: string): Promise<ActionResult<Subcategory>> {
  return runAction(() => withTenant(() => financialSubcategoryUseCases.restore.execute(id)));
}

export async function quickCreateFinancialSubcategoryAction(input: Record<string, unknown>): Promise<ActionResult<Subcategory>> {
  return runAction(async () => {
    const data = quickCreateFinancialSubcategorySchema.parse(input);
    return withTenant(() => financialSubcategoryUseCases.quickCreate.execute(data));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listSubcategoriesAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedSubcategories>> {
  return runAction(() => listFinancialSubcategoriesData(raw));
}

export async function getSubcategoryByIdAction(id: string): Promise<ActionResult<Subcategory>> {
  return runAction(() => getSubcategoryByIdData(id));
}

export async function getSubcategoryFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getSubcategoryFiltersData(raw));
}