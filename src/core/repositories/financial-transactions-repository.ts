import type {
  AvailableYearsResult,
  CreateInstallmentsData,
  CreateRecurrenceData,
  CreateTransactionData,
  CreateTransferData,
  ExpenseByCategoryResult,
  InstallmentsResult,
  ListTransactionsParams,
  MonthlySummary,
  MonthlySummaryMultiResult,
  PaginatedTransactions,
  RecurrenceResult,
  RelatedTransactionsResult,
  SubcategoryBreakdownResult,
  Transaction,
  TransactionDocument,
  TransactionEntityFilters,
  TransactionFiltersResult,
  TransferResult,
  UpdateTransactionData,
} from '@/core/entities/financial-transaction';

/**
 * Contrato de acesso a dados de Lancamento financeiro (Transaction).
 * Implementacao Prisma: infra/repositories/prisma-financial-transactions-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.transaction.*` em api-nairim-v2/src/services/TransactionService.ts,
 * TransferService.ts e RecurringService.ts.
 */
export interface TransactionsRepository {
  list(params: ListTransactionsParams): Promise<PaginatedTransactions>;
  getFilters(filters?: Record<string, unknown>): Promise<TransactionFiltersResult>;
  findById(id: string): Promise<Transaction | null>;
  /** Cria lancamento vinculando a fatura do cartao quando houver card_id. */
  create(data: CreateTransactionData & { company_id?: string }): Promise<Transaction>;
  /**
   * Atualiza lancamento; espelha a perna de transferencia e propaga para as
   * parcelas/ocorrencias seguintes da serie quando solicitado.
   */
  update(id: string, data: UpdateTransactionData): Promise<Transaction>;
  /** Soft-delete; quando for transferencia, remove ambas as pernas. */
  delete(id: string): Promise<Transaction>;
  findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<Transaction>;
  /** Cria o par de lancamentos (origem + espelho) de uma transferencia. */
  createTransfer(data: CreateTransferData & { company_id?: string }): Promise<TransferResult>;
  /** Cria N parcelas compartilhando installment_group_id (sem transacao pai). */
  createInstallments(data: CreateInstallmentsData & { company_id?: string }): Promise<InstallmentsResult>;
  /** Cria config de recorrencia e gera as ocorrencias (~5 anos, idempotente). */
  createRecurrence(data: CreateRecurrenceData & { company_id?: string }): Promise<RecurrenceResult>;
  /** Pai/grupo + lancamentos relacionados (parcelas ou ocorrencias). */
  getRelated(id: string): Promise<RelatedTransactionsResult>;
  /** Resumo mensal (Receitas vs Despesas) de um ano — `GET /monthly-summary`. */
  getMonthlySummary(year: number, filters?: TransactionEntityFilters): Promise<MonthlySummary>;
  /** Resumo mensal de vários anos — `GET /monthly-summary-multi`. */
  getMonthlySummaryMulti(years: number[], filters?: TransactionEntityFilters): Promise<MonthlySummaryMultiResult>;
  /** Anos com lançamentos cadastrados — `GET /available-years`. */
  getAvailableYears(): Promise<AvailableYearsResult>;
  /** Despesas por categoria (com total de receita) — `GET /expense-by-category`. */
  getExpenseByCategory(startDate: Date, endDate: Date, filters?: TransactionEntityFilters): Promise<ExpenseByCategoryResult>;
  /** Detalhamento de gastos por subcategoria — `GET /subcategory-breakdown`. */
  getSubcategoryBreakdown(categoryId: string, startDate: Date, endDate: Date, filters?: TransactionEntityFilters): Promise<SubcategoryBreakdownResult>;
  /** Anexos do lançamento — `GET /:id/documents`. */
  listDocuments(transactionId: string): Promise<TransactionDocument[]>;
  /** Conta os anexos ativos (respeita MAX_TRANSACTION_ATTACHMENTS). */
  countDocuments(transactionId: string): Promise<number>;
  /** Cria os registros `Document` dos arquivos já enviados ao storage. */
  createDocuments(transactionId: string, documents: Array<{ url: string; mimetype: string; description: string; createdBy: string | null }>): Promise<TransactionDocument[]>;
  /** Soft-delete de anexos (id ∈ `documentIds`, restrito ao lançamento). */
  removeDocuments(transactionId: string, documentIds: string[]): Promise<void>;
}