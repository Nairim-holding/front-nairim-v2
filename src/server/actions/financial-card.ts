'use server';

import { financialCardUseCases } from '@/infra/factories/financial-card-factory';
import {
  cardUsageSummarySchema,
  createFinancialCardSchema,
  quickCreateFinancialCardSchema,
  updateFinancialCardSchema,
} from '@/shared/validators/financial-card';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type { Card, CardUsageItem, PaginatedCards } from '@/core/entities/financial-card';
import {
  getCardByIdData,
  getCardFiltersData,
  getCardUsageSummaryData,
  listFinancialCardsData,
} from '@/server/queries/financial-card';

/**
 * Server Actions do módulo Cartões Financeiros.
 * Substituem os endpoints de `/financial-card`.
 * Guarda: `withTenant`. Camada: server. Origem: CardController.
 */

export async function createFinancialCardAction(input: Record<string, unknown>): Promise<ActionResult<Card>> {
  return runAction(async () => {
    const data = createFinancialCardSchema.parse(input);
    return withTenant(() => financialCardUseCases.create.execute(data));
  });
}

export async function updateFinancialCardAction(id: string, input: Record<string, unknown>): Promise<ActionResult<Card>> {
  return runAction(async () => {
    const data = updateFinancialCardSchema.parse(input);
    return withTenant(() => financialCardUseCases.update.execute(id, data));
  });
}

export async function deleteFinancialCardAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withTenant(() => financialCardUseCases.remove.execute(id));
    return null;
  });
}

export async function restoreFinancialCardAction(id: string): Promise<ActionResult<Card>> {
  return runAction(() => withTenant(() => financialCardUseCases.restore.execute(id)));
}

export async function quickCreateFinancialCardAction(input: Record<string, unknown>): Promise<ActionResult<Card>> {
  return runAction(async () => {
    const data = quickCreateFinancialCardSchema.parse(input);
    return withTenant(() => financialCardUseCases.quickCreate.execute(data));
  });
}

export async function getCardUsageSummaryAction(
  input: Record<string, unknown>,
): Promise<ActionResult<CardUsageItem[]>> {
  return runAction(async () => {
    const parsed = cardUsageSummarySchema.parse(input);
    const filters = {
      category_id: parsed.category_id,
      subcategory_id: parsed.subcategory_id,
      financial_institution_id: parsed.financial_institution_id,
      card_id: parsed.card_id,
      center_id: parsed.center_id,
      supplier_id: parsed.supplier_id,
      description: parsed.description,
    };
    return getCardUsageSummaryData(parsed.startDate, parsed.endDate, filters);
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listCardsAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedCards>> {
  return runAction(() => listFinancialCardsData(raw));
}

export async function getCardByIdAction(id: string): Promise<ActionResult<Card>> {
  return runAction(() => getCardByIdData(id));
}

export async function getCardFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getCardFiltersData(raw));
}