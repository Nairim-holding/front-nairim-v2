'use server';

import { financialCategoryUseCases } from '@/infra/factories/financial-category-factory';
import {
  createFinancialCategorySchema,
  quickCreateFinancialCategorySchema,
  updateFinancialCategorySchema,
} from '@/shared/validators/financial-category';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type { Category, PaginatedCategories } from '@/core/entities/category';
import {
  getCategoryByIdData,
  getCategoryFiltersData,
  listFinancialCategoriesData,
} from '@/server/queries/financial-category';

/**
 * Server Actions do módulo Categorias Financeiras.
 * Substituem os endpoints de `/financial-category`.
 * Guarda: `withTenant`. Camada: server. Origem: CategoryController.
 */

export async function createFinancialCategoryAction(input: Record<string, unknown>): Promise<ActionResult<Category>> {
  return runAction(async () => {
    const data = createFinancialCategorySchema.parse(input);
    return withTenant(() => financialCategoryUseCases.create.execute(data));
  });
}

export async function updateFinancialCategoryAction(id: string, input: Record<string, unknown>): Promise<ActionResult<Category>> {
  return runAction(async () => {
    const data = updateFinancialCategorySchema.parse(input);
    return withTenant(() => financialCategoryUseCases.update.execute(id, data));
  });
}

export async function deleteFinancialCategoryAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withTenant(() => financialCategoryUseCases.remove.execute(id));
    return null;
  });
}

export async function restoreFinancialCategoryAction(id: string): Promise<ActionResult<Category>> {
  return runAction(() => withTenant(() => financialCategoryUseCases.restore.execute(id)));
}

export async function quickCreateFinancialCategoryAction(input: Record<string, unknown>): Promise<ActionResult<Category>> {
  return runAction(async () => {
    const data = quickCreateFinancialCategorySchema.parse(input);
    return withTenant(() => financialCategoryUseCases.quickCreate.execute(data));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listCategoriesAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedCategories>> {
  return runAction(() => listFinancialCategoriesData(raw));
}

export async function getCategoryByIdAction(id: string): Promise<ActionResult<Category>> {
  return runAction(() => getCategoryByIdData(id));
}

export async function getCategoryFiltersAction(): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getCategoryFiltersData());
}