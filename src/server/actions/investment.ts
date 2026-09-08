'use server';

import { investmentUseCases } from '@/infra/factories/investment-factory';
import {
  createInvestmentSchema,
  investmentMonthBalanceSchema,
  investmentNotesSchema,
  investmentReorderSchema,
  investmentSettingsSchema,
  investmentTransactionListSchema,
  investmentTransactionSchema,
  investmentTransactionUpdateSchema,
  updateInvestmentSchema,
} from '@/shared/validators/investment';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withPermission, withPermissionInput } from '@/infra/auth/session';
import type {
  Investment,
  InvestmentDashboardResponse,
  InvestmentSettings,
  InvestmentTransactionEntry,
} from '@/core/entities/investment';
import {
  getInvestmentDashboardData,
  getInvestmentFiltersData,
  getInvestmentSettingsData,
  listInvestmentsData,
} from '@/server/queries/investment';

/**
 * Server Actions do módulo Investimentos.
 * Guarda: `withTenant`. Camada: server.
 */

export async function createInvestmentAction(
  input: Record<string, unknown>,
): Promise<ActionResult<Investment>> {
  return runAction(async () => {
    const data = createInvestmentSchema.parse(input);
    return withPermissionInput('investments', 'create', input, () =>
      investmentUseCases.create.execute({
        financial_institution_id: data.financial_institution_id,
        partition: data.partition ?? undefined,
        issuer: data.issuer,
        product_type: data.product_type,
        product: data.product,
        application_date: data.application_date,
        maturity_date: data.maturity_date ?? null,
        liquidity_days: data.liquidity_days ?? null,
        liquidity_at_maturity: data.liquidity_at_maturity ?? false,
        invested_amount: data.invested_amount,
        notes: data.notes ?? null,
      }),
    );
  });
}

export async function updateInvestmentAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<Investment>> {
  return runAction(async () => {
    const { partition, ...rest } = updateInvestmentSchema.parse(input);
    // Campo ausente = não mexer; `null` explícito = limpar. O Zod já omite as
    // chaves não enviadas, então o spread preserva essa distinção — normalizar
    // tudo para `null` aqui apagaria vencimento/observações a cada edição.
    // `partition` é a exceção: não é anulável, então só vai quando tem valor.
    return withPermissionInput('investments', 'edit', input, () =>
      investmentUseCases.update.execute(id, {
        ...rest,
        ...(partition != null ? { partition } : {}),
      }),
    );
  });
}

export async function deleteInvestmentAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withPermission('investments', 'delete', () => investmentUseCases.remove.execute(id));
    return null;
  });
}

export async function reorderInvestmentsAction(
  input: Record<string, unknown>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { ordered_ids } = investmentReorderSchema.parse(input);
    await withPermission('investments', 'edit', () => investmentUseCases.reorder.execute(ordered_ids));
    return null;
  });
}

export async function updateInvestmentNotesAction(
  input: Record<string, unknown>,
): Promise<ActionResult<Investment>> {
  return runAction(async () => {
    const { id, notes } = investmentNotesSchema.parse(input);
    return withPermissionInput('investments', 'edit', input, () => investmentUseCases.updateNotes.execute(id, notes ?? null));
  });
}

// ─── Aportes e resgates ───────────────────────────────────────────────────────

export async function listInvestmentTransactionsAction(
  input: Record<string, unknown>,
): Promise<ActionResult<InvestmentTransactionEntry[]>> {
  return runAction(async () => {
    const { investment_id, year, month } = investmentTransactionListSchema.parse(input);
    return withPermission('investments', 'view', () => investmentUseCases.listTransactions.execute(investment_id, year, month));
  });
}

export async function createInvestmentTransactionAction(
  input: Record<string, unknown>,
): Promise<ActionResult<InvestmentTransactionEntry>> {
  return runAction(async () => {
    const data = investmentTransactionSchema.parse(input);
    return withPermissionInput('investments', 'create', input, () => investmentUseCases.createTransaction.execute(data));
  });
}

export async function updateInvestmentTransactionAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<InvestmentTransactionEntry>> {
  return runAction(async () => {
    const data = investmentTransactionUpdateSchema.parse(input);
    return withPermissionInput('investments', 'edit', input, () => investmentUseCases.updateTransaction.execute(id, data));
  });
}

export async function deleteInvestmentTransactionAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withPermission('investments', 'delete', () => investmentUseCases.deleteTransaction.execute(id));
    return null;
  });
}

// ─── Saldo do mês ─────────────────────────────────────────────────────────────

export async function setInvestmentMonthBalanceAction(
  input: Record<string, unknown>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { investment_id, year, month, balance } = investmentMonthBalanceSchema.parse(input);
    await withPermission('investments', 'edit', () => investmentUseCases.setMonthBalance.execute(investment_id, year, month, balance));
    return null;
  });
}

// ─── Configuração ─────────────────────────────────────────────────────────────

export async function saveInvestmentSettingsAction(
  input: Record<string, unknown>,
): Promise<ActionResult<InvestmentSettings>> {
  return runAction(async () => {
    const data = investmentSettingsSchema.parse(input);
    return withPermissionInput('investments', 'edit', input, () => investmentUseCases.saveSettings.execute(data));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function getInvestmentDashboardAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<InvestmentDashboardResponse>> {
  return runAction(() => getInvestmentDashboardData(raw));
}

export async function listInvestmentsAction(): Promise<ActionResult<Investment[]>> {
  return runAction(() => listInvestmentsData());
}

export async function getInvestmentFiltersAction(): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getInvestmentFiltersData());
}

export async function getInvestmentSettingsAction(): Promise<ActionResult<InvestmentSettings>> {
  return runAction(() => getInvestmentSettingsData());
}
