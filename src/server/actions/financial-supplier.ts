'use server';

import { financialSupplierUseCases } from '@/infra/factories/financial-supplier-factory';
import {
  createFinancialSupplierSchema,
  quickCreateFinancialSupplierSchema,
  updateFinancialSupplierSchema,
} from '@/shared/validators/financial-supplier';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withPermission, withPermissionInput } from '@/infra/auth/session';
import type { PaginatedSuppliers, Supplier } from '@/core/entities/financial-supplier';
import {
  getSupplierByIdData,
  getSupplierFiltersData,
  listFinancialSuppliersData,
} from '@/server/queries/financial-supplier';

/**
 * Server Actions do módulo Fornecedores.
 * Substituem os endpoints de `/financial-supplier`.
 * Guarda: `withTenant`. Camada: server. Origem: SupplierController.
 */

export async function createFinancialSupplierAction(input: Record<string, unknown>): Promise<ActionResult<Supplier>> {
  return runAction(async () => {
    const data = createFinancialSupplierSchema.parse(input);
    return withPermissionInput('financial-suppliers', 'create', input, () => financialSupplierUseCases.create.execute(data));
  });
}

export async function updateFinancialSupplierAction(id: string, input: Record<string, unknown>): Promise<ActionResult<Supplier>> {
  return runAction(async () => {
    const data = updateFinancialSupplierSchema.parse(input);
    return withPermissionInput('financial-suppliers', 'edit', input, () => financialSupplierUseCases.update.execute(id, data));
  });
}

export async function deleteFinancialSupplierAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withPermission('financial-suppliers', 'delete', () => financialSupplierUseCases.remove.execute(id));
    return null;
  });
}

export async function restoreFinancialSupplierAction(id: string): Promise<ActionResult<Supplier>> {
  return runAction(() => withPermission('financial-suppliers', 'edit', () => financialSupplierUseCases.restore.execute(id)));
}

export async function quickCreateFinancialSupplierAction(input: Record<string, unknown>): Promise<ActionResult<Supplier>> {
  return runAction(async () => {
    const data = quickCreateFinancialSupplierSchema.parse(input);
    return withPermissionInput('financial-suppliers', 'create', input, () => financialSupplierUseCases.quickCreate.execute(data));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listSuppliersAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedSuppliers>> {
  return runAction(() => listFinancialSuppliersData(raw));
}

export async function getSupplierByIdAction(id: string): Promise<ActionResult<Supplier>> {
  return runAction(() => getSupplierByIdData(id));
}

export async function getSupplierFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getSupplierFiltersData(raw));
}
