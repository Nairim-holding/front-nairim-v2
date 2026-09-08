'use server';

import { financialInvoiceUseCases } from '@/infra/factories/financial-invoice-factory';
import {
  createInvoiceSchema,
  getInvoicesByCardSchema,
  getInvoiceQuerySchema,
  updateInvoiceStatusSchema,
} from '@/shared/validators/financial-invoice';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withPermission, withPermissionInput } from '@/infra/auth/session';
import type {
  InvoiceByCardItem,
  InvoiceTransaction,
  InvoiceWithRelations,
  UpdateInvoiceStatusResult,
} from '@/core/entities/financial-invoice';
import {
  getInvoiceByCardAndMonthData,
  getInvoicesByCardData,
  getInvoiceTransactionsData,
} from '@/server/queries/financial-invoice';

/**
 * Server Actions do modulo Faturas de Cartao.
 * Substituem os endpoints de `/financial-invoice`.
 * Guarda: `withTenant`. Camada: server. Origem: InvoiceController.
 */

export async function createInvoiceAction(input: Record<string, unknown>): Promise<ActionResult<InvoiceWithRelations>> {
  return runAction(async () => {
    const data = createInvoiceSchema.parse(input);
    return withPermissionInput('financial-transactions', 'create', input, () => financialInvoiceUseCases.create.execute(data));
  });
}

export async function updateInvoiceStatusAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<UpdateInvoiceStatusResult>> {
  return runAction(async () => {
    const data = updateInvoiceStatusSchema.parse(input);
    return withPermissionInput('financial-transactions', 'edit', input, () => financialInvoiceUseCases.updateStatus.execute(id, data));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function getInvoiceAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<InvoiceWithRelations | null>> {
  return runAction(async () => {
    const { cardId, month, year } = getInvoiceQuerySchema.parse(raw);
    return getInvoiceByCardAndMonthData(cardId, month, year);
  });
}

export async function getInvoiceTransactionsAction(invoiceId: string): Promise<ActionResult<InvoiceTransaction[]>> {
  return runAction(() => getInvoiceTransactionsData(invoiceId));
}

export async function getInvoicesByCardAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<InvoiceByCardItem[]>> {
  return runAction(async () => {
    const { cardId, year } = getInvoicesByCardSchema.parse(raw);
    return getInvoicesByCardData(cardId, year);
  });
}
