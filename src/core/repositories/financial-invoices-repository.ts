import type {
  CreateInvoiceData,
  GetInvoiceParams,
  Invoice,
  InvoiceByCardItem,
  InvoiceTransaction,
  InvoiceWithRelations,
  UpdateInvoiceStatusData,
  UpdateInvoiceStatusResult,
} from '@/core/entities/financial-invoice';

/**
 * Contrato de acesso a dados de Fatura de cartao (Invoice).
 * Implementacao Prisma: infra/repositories/prisma-financial-invoices-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.invoice.*` em api-nairim-v2/src/services/InvoiceService.ts.
 */
export interface InvoicesRepository {
  /** Busca unica por cartao + mes + ano. Recalcula total quando divergente. */
  getByCardAndMonth(params: GetInvoiceParams): Promise<InvoiceWithRelations | null>;
  /** Cria fatura validando cartao e unicidade (card_id, month, year). */
  create(data: CreateInvoiceData & { company_id?: string }): Promise<InvoiceWithRelations>;
  /** Atualiza status e propaga para os lancamentos da fatura (transacao unica). */
  updateStatus(id: string, data: UpdateInvoiceStatusData): Promise<UpdateInvoiceStatusResult>;
  /** Lista lancamentos nao excluidos de uma fatura. */
  getTransactions(invoiceId: string): Promise<InvoiceTransaction[]>;
  /** Lista faturas por cartao, ordenadas ano/mes desc, com transaction_count. */
  getByCard(cardId: string, year?: number): Promise<InvoiceByCardItem[]>;
}