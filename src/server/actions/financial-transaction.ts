'use server';

import { financialTransactionUseCases } from '@/infra/factories/financial-transaction-factory';
import {
  createFinancialTransactionSchema,
  createInstallmentsSchema,
  createRecurrenceSchema,
  createTransferSchema,
  updateFinancialTransactionSchema,
} from '@/shared/validators/financial-transaction';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type {
  AvailableYearsResult,
  ExpenseByCategoryResult,
  InstallmentsResult,
  MonthlySummary,
  MonthlySummaryMultiResult,
  PaginatedTransactions,
  RecurrenceResult,
  RelatedTransactionsResult,
  SubcategoryBreakdownResult,
  Transaction,
  TransactionDocument,
  TransactionFiltersResult,
  TransferResult,
} from '@/core/entities/financial-transaction';
import type { TransactionAttachmentFile } from '@/core/entities/financial-transaction';
import {
  getRelatedTransactionsData,
  getTransactionByIdData,
  getTransactionFiltersData,
  listFinancialTransactionsData,
} from '@/server/queries/financial-transaction';
import {
  getAvailableYearsData,
  getExpenseByCategoryData,
  getMonthlySummaryData,
  getMonthlySummaryMultiData,
  getSubcategoryBreakdownData,
  getTransactionDocumentsData,
} from '@/server/queries/financial-reports';

/**
 * Server Actions do módulo Lançamentos financeiros.
 * Substituem os endpoints de `/financial-transaction`.
 * Guarda: `withTenant`. Camada: server. Origem: TransactionController.
 */

export async function createFinancialTransactionAction(
  input: Record<string, unknown>,
): Promise<ActionResult<Transaction>> {
  return runAction(async () => {
    const data = createFinancialTransactionSchema.parse(input);
    return withTenant(() => financialTransactionUseCases.create.execute(data));
  });
}

export async function updateFinancialTransactionAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<Transaction>> {
  return runAction(async () => {
    const data = updateFinancialTransactionSchema.parse(input);
    return withTenant(() => financialTransactionUseCases.update.execute(id, data));
  });
}

export async function deleteFinancialTransactionAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withTenant(() => financialTransactionUseCases.remove.execute(id));
    return null;
  });
}

export async function restoreFinancialTransactionAction(id: string): Promise<ActionResult<Transaction>> {
  return runAction(() => withTenant(() => financialTransactionUseCases.restore.execute(id)));
}

export async function createTransferAction(input: Record<string, unknown>): Promise<ActionResult<TransferResult>> {
  return runAction(async () => {
    const data = createTransferSchema.parse(input);
    return withTenant(() => financialTransactionUseCases.createTransfer.execute(data));
  });
}

export async function createInstallmentsAction(
  input: Record<string, unknown>,
): Promise<ActionResult<InstallmentsResult>> {
  return runAction(async () => {
    const data = createInstallmentsSchema.parse(input);
    return withTenant(() => financialTransactionUseCases.createInstallments.execute(data));
  });
}

export async function createRecurrenceAction(
  input: Record<string, unknown>,
): Promise<ActionResult<RecurrenceResult>> {
  return runAction(async () => {
    const data = createRecurrenceSchema.parse(input);
    return withTenant(() => financialTransactionUseCases.createRecurrence.execute(data));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listFinancialTransactionsAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<PaginatedTransactions>> {
  return runAction(() => listFinancialTransactionsData(raw));
}

export async function getTransactionByIdAction(id: string): Promise<ActionResult<Transaction>> {
  return runAction(() => getTransactionByIdData(id));
}

export async function getTransactionFiltersAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<TransactionFiltersResult>> {
  return runAction(() => getTransactionFiltersData(raw));
}

export async function getRelatedTransactionsAction(id: string): Promise<ActionResult<RelatedTransactionsResult>> {
  return runAction(() => getRelatedTransactionsData(id));
}

// ─── Relatórios (Dashboard/Financeiro) ──────────────────────────────────────

export async function getMonthlySummaryAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<MonthlySummary>> {
  return runAction(() => getMonthlySummaryData(raw));
}

export async function getMonthlySummaryMultiAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<MonthlySummaryMultiResult>> {
  return runAction(() => getMonthlySummaryMultiData(raw));
}

export async function getAvailableYearsAction(): Promise<ActionResult<AvailableYearsResult>> {
  return runAction(() => getAvailableYearsData());
}

export async function getExpenseByCategoryAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<ExpenseByCategoryResult>> {
  return runAction(() => getExpenseByCategoryData(raw));
}

export async function getSubcategoryBreakdownAction(
  raw: Record<string, unknown>,
): Promise<ActionResult<SubcategoryBreakdownResult>> {
  return runAction(() => getSubcategoryBreakdownData(raw));
}

// ─── Anexos do lançamento (Tarefa 2) ────────────────────────────────────────

export async function getTransactionDocumentsAction(
  transactionId: string,
): Promise<ActionResult<TransactionDocument[]>> {
  return runAction(() => getTransactionDocumentsData(transactionId));
}

/**
 * Envia anexos (multipart) do lançamento. Contrato do POST
 * /financial-transaction/:id/documents: arquivos no campo `attachments`.
 * Origem: DocumentService.uploadTransactionDocuments (upload.array('attachments')).
 */
export async function uploadTransactionDocumentsAction(
  transactionId: string,
  formData: FormData,
): Promise<ActionResult<TransactionDocument[]>> {
  return runAction(async () => {
    const userId = await withTenant((session) => Promise.resolve(session.id));
    const files: TransactionAttachmentFile[] = [];
    for (const entry of formData.getAll('attachments')) {
      if (!(entry instanceof File)) continue;
      files.push({
        buffer: Buffer.from(await entry.arrayBuffer()),
        filename: entry.name,
        contentType: entry.type || 'application/octet-stream',
      });
    }
    return withTenant(() => financialTransactionUseCases.uploadDocuments.execute(transactionId, userId, files));
  });
}

/** Exclui um anexo do lançamento. DELETE /financial-transaction/:id/documents/:documentId. */
export async function deleteTransactionDocumentAction(
  transactionId: string,
  documentId: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withTenant(() => financialTransactionUseCases.removeDocument.execute(transactionId, documentId));
    return null;
  });
}