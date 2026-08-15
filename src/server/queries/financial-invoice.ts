import 'server-only';
import { financialInvoiceUseCases } from '@/infra/factories/financial-invoice-factory';
import { withTenant } from '@/infra/auth/session';
import type {
  InvoiceByCardItem,
  InvoiceTransaction,
  InvoiceWithRelations,
} from '@/core/entities/financial-invoice';

/**
 * Queries (leitura) do modulo Faturas — usadas pelas Server Actions.
 * Guarda: `withTenant`. Camada: server. Origem: InvoiceController (GETs).
 */

export async function getInvoiceByCardAndMonthData(
  cardId: string,
  month: number,
  year: number,
): Promise<InvoiceWithRelations | null> {
  return withTenant(() => financialInvoiceUseCases.getByCardAndMonth.execute({ cardId, month, year }));
}

export async function getInvoiceTransactionsData(invoiceId: string): Promise<InvoiceTransaction[]> {
  return withTenant(() => financialInvoiceUseCases.getTransactions.execute(invoiceId));
}

export async function getInvoicesByCardData(cardId: string, year?: number): Promise<InvoiceByCardItem[]> {
  return withTenant(() => financialInvoiceUseCases.getByCard.execute(cardId, year));
}