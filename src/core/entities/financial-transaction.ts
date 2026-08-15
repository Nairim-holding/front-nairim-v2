/**
 * Entidades de dominio: Lancamento financeiro (Transaction) e agregados
 * (transferencia, parcelado, recorrencia) usados pelo Modulo 9g.
 *
 * Fidelidade ao backend (TransactionService/TransferService/RecurringService):
 *  - createTransaction vincula o lancamento a fatura do cartao
 *    (findOrCreateInvoice) e incrementa invoice.total_amount.
 *  - update propaga (parcelas/ocorrencias seguintes) e espelha a perna de
 *    transferencia.
 *  - delete faz soft-delete em cascata do par de transferencia.
 *  - installments gera installment_group_id compartilhado (sem pai).
 *  - recurrence e o modelo unico config-based (~5 anos a frente).
 *
 * Camada: core. Origem: models do prisma (Transaction, RecurringConfig).
 */

export type TransactionStatus = 'PENDING' | 'COMPLETED';

export type PaymentMode = 'PARCELADO' | 'RECORRENTE';

export type RecurringFrequency =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'YEARLY';

/** Registro de lancamento, com relacoes anexadas (opcionais). */
export interface Transaction {
  id: string;
  company_id: string;
  event_date: Date;
  effective_date: Date;
  purchase_date: Date | null;
  description: string;
  amount: number;
  status: TransactionStatus;
  category_id: string;
  subcategory_id: string | null;
  financial_institution_id: string;
  card_id: string | null;
  center_id: string | null;
  supplier_id: string | null;
  invoice_id: string | null;
  lease_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  is_recurring: boolean;
  occurrence_number: number | null;
  parent_transaction_id: string | null;
  payment_mode: PaymentMode | null;
  recurring_frequency: RecurringFrequency | null;
  recurring_group_id: string | null;
  transfer_group_id: string | null;
  is_transfer: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  category?: Record<string, unknown> & { name?: string; type?: string; [key: string]: unknown };
  subcategory?: Record<string, unknown> & { name?: string; [key: string]: unknown };
  financial_institution?: Record<string, unknown> & { name?: string; [key: string]: unknown };
  card?: Record<string, unknown> & { name?: string; [key: string]: unknown };
  center?: Record<string, unknown> & { name?: string; [key: string]: unknown };
  supplier?: Record<string, unknown> & { legal_name?: string; name?: string; [key: string]: unknown };
  invoice?: Record<string, unknown>;
  child_transactions?: Transaction[];
  _count?: { documents?: number };
  _attachmentsCount?: number;
  [key: string]: unknown;
}

/** Dados de criacao — obrigatorios como no TransactionValidator do backend. */
export interface CreateTransactionData {
  event_date: string;
  effective_date: string;
  description?: string | null;
  amount: number;
  status?: TransactionStatus;
  category_id: string;
  subcategory_id?: string | null;
  financial_institution_id: string;
  card_id?: string | null;
  center_id?: string | null;
  supplier_id?: string | null;
}

/** Dados de atualizacao — todos opcionais; inclui a propagacao de serie. */
export interface UpdateTransactionData {
  event_date?: string;
  effective_date?: string;
  description?: string | null;
  amount?: number;
  status?: TransactionStatus;
  category_id?: string;
  subcategory_id?: string | null;
  financial_institution_id?: string;
  card_id?: string | null;
  center_id?: string | null;
  supplier_id?: string | null;
  /** Aplica os campos as parcelas/ocorrencias SEGUINTES da serie. */
  propagate_to_following?: boolean;
  /** Whitelist de campos a propagar (sanitizada no use-case). */
  propagate_fields?: string[];
}

export interface ListTransactionsParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedTransactions {
  data: Transaction[];
  count: number;
  totalPages: number;
  currentPage: number;
  summary: TransactionSummary[];
  totals: TransactionTotals;
}

/** GroupBy por status: [_sum.amount]. */
export interface TransactionSummary {
  status: TransactionStatus;
  _sum: { amount: number | null } | null;
  [key: string]: unknown;
}

/** Totais do grid de lancamentos (resumo e saldos). */
export interface TransactionTotals {
  periodIncome: number;
  periodExpense: number;
  periodBalance: number;
  accumulatedIncome: number;
  accumulatedExpense: number;
  accumulatedBalance: number;
  receitasPrevisto: number;
  receitasRecebido: number;
  despesasPrevisto: number;
  despesasPago: number;
}

export interface TransactionFilterDefinition {
  field: string;
  type: 'string' | 'date' | 'enum' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  multiple?: boolean;
  searchable?: boolean;
  numberRange?: boolean;
  values?: Array<Record<string, unknown>>;
  dependsOn?: { field: string; matchKey: string };
  [key: string]: unknown;
}

export interface TransactionFiltersResult {
  filters: TransactionFilterDefinition[];
  operators: Record<string, string[]>;
  defaultSort: string;
  searchFields: string[];
}

/** Entrada do endpoint de transferencia entre contas. */
export interface CreateTransferData {
  financial_institution_id: string;
  destination_institution_id: string;
  destination_center_id: string;
  amount: number;
  category_id: string;
  event_date: string;
  effective_date: string;
  description?: string | null;
  status?: TransactionStatus;
  center_id?: string | null;
  supplier_id?: string | null;
}

export interface TransferResult {
  transfer_group_id: string;
  origin: Transaction;
  mirror: Transaction;
}

/** Entrada do parcelado (campos do ParceladoRecorrenteModal). */
export interface CreateInstallmentsData {
  transaction_type: 'INCOME' | 'EXPENSE';
  institution_id?: string | null;
  category_id: string;
  subcategory_id?: string | null;
  card_id?: string | null;
  center_id?: string | null;
  supplier_id?: string | null;
  description?: string | null;
  installment_amount: number;
  num_installments: number;
  total_amount: number;
  start_date: string;
  first_payment_date: string;
}

export interface InstallmentRecord {
  id: string;
  installment_number: number;
  amount: number;
  effective_date: Date;
  description: string;
  status: TransactionStatus;
  invoice_id: string | null;
}

export interface InstallmentsResult {
  success: boolean;
  message: string;
  data: {
    num_installments: number;
    installment_amount: number;
    total_amount: number;
    installments: InstallmentRecord[];
  };
  validation: {
    sum_of_installments: number;
    expected_total: number;
    matches: boolean;
  };
}

/** Entrada do modelo unico de recorrencia infinita (RecurringService). */
export interface CreateRecurrenceData {
  transaction_type?: 'INCOME' | 'EXPENSE';
  frequency?: RecurringFrequency;
  institution_id?: string | null;
  category_id: string;
  subcategory_id?: string | null;
  card_id?: string | null;
  center_id?: string | null;
  supplier_id?: string | null;
  description?: string | null;
  amount: number;
  start_date: string;
  first_payment_date: string;
}

export interface RecurrenceResult {
  success: boolean;
  message: string;
  data: {
    recurring_group_id: string;
    frequency: RecurringFrequency;
    generated: number;
  };
}

export interface RelatedTransactionsResult {
  parent: {
    id: string | null;
    type?: string | null;
    total_amount?: number | null;
    total_installments?: number | null;
  } | null;
  related_transactions: Transaction[];
}

/**
 * ─── Relatórios / agregações do grid financeiro ─────────────────────────────
 * Correspondem aos endpoints de agregação ainda não portados no Módulo 9g:
 * `/monthly-summary`, `/monthly-summary-multi`, `/available-years`,
 * `/expense-by-category` e `/subcategory-breakdown`.
 * Origem: TransactionService.getMonthlyIncomeExpenseSummary,
 * getMonthlyIncomeExpenseSummaryMulti, getAvailableYears, getExpenseByCategory,
 * getSubcategoryBreakdown.
 */

/** Filtros do botão Filtro (Tarefa 5.1) — chave repetida = seleção múltipla. */
export interface TransactionEntityFilters {
  category_id?: string[];
  subcategory_id?: string[];
  financial_institution_id?: string[];
  card_id?: string[];
  center_id?: string[];
  supplier_id?: string[];
  description?: string[];
}

/** Um mês do resumo mensal (Receitas vs Despesas). */
export interface MonthSummary {
  month: number;
  income: number;
  expense: number;
}

/** Resumo de um ano (`year` + os 12 `months`). */
export interface MonthlySummary {
  year: number;
  months: MonthSummary[];
}

/** Resultado de `/monthly-summary-multi` (uma entrada por ano). */
export type MonthlySummaryMultiResult = MonthlySummary[];

/** Anos disponíveis (ordenados do mais recente para o mais antigo). */
export interface AvailableYearsResult {
  years: number[];
}

/** Detalhamento por ano de um valor de gasto (tooltip multi-ano). */
export interface ByYearValue {
  year: number;
  value: number;
}

/** Item de despesa por categoria. */
export interface ExpenseByCategoryItem {
  categoryId: string;
  name: string;
  value: number;
  /** Preenchido quando o período cobre mais de um ano. */
  byYear?: ByYearValue[];
}

export interface ExpenseByCategoryResult {
  totalIncome: number;
  categories: ExpenseByCategoryItem[];
}

/** Item de detalhamento por subcategoria. */
export interface SubcategoryBreakdownItem {
  subcategoryId: string | null;
  name: string;
  value: number;
  byYear?: ByYearValue[];
}

export interface SubcategoryBreakdownResult {
  categoryId: string;
  categoryName: string;
  total: number;
  subcategories: SubcategoryBreakdownItem[];
}

/** Anexo/arquivo de um lançamento (tabela Document → transaction_id). */
export interface TransactionDocument {
  id: string;
  transaction_id: string | null;
  file_path: string;
  file_type: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/** Arquivo a enviar como anexo (lido em memória no servidor). */
export interface TransactionAttachmentFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}