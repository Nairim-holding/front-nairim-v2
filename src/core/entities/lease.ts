/**
 * Entidades de domínio: Locação (Lease) e o schedule financeiro gerado por ela.
 *
 * Camada: core.
 * Origem: model `Lease` (prisma/schema.prisma),
 * api-nairim-v2/src/services/LeaseService.ts e LeaseFinanceService.ts.
 */

/** Item individual de parcelamento livre de IPTU (payment_condition = INSTALLMENTS). */
export interface IptuInstallmentInput {
  value?: string | number;
  due_date?: string | null;
}

/** Fiador (estrutura livre — persistida como JSON, não validada em profundidade). */
export type Guarantor = Record<string, unknown>;

/** Registro de locação (com relações carregadas). */
export interface Lease {
  id: string;
  company_id: string;
  property_id: string;
  type_id: string;
  owner_id: string;
  tenant_id: string;
  agency_id?: string | null;
  financial_institution_id?: string | null;
  contract_number: string;
  start_date: Date;
  end_date: Date;
  rent_amount: number;
  condo_fee?: number | null;
  property_tax?: number | null;
  extra_charges?: number | null;
  /** Desconto/despesa acordado na locação — abate o valor líquido no Relatório de Locações. */
  discount_amount?: number | null;
  commission_amount?: number | null;
  rent_due_day: number;
  tax_due_day?: number | null;
  condo_due_day?: number | null;
  status: string;
  canceled_at?: Date | null;
  cancellation_justification?: string | null;
  cancellation_penalty?: number | null;
  other_cancellation_amounts?: number | null;
  payment_condition?: string | null;
  property_tax_cash?: number | null;
  property_tax_cash_due_date?: Date | null;
  property_tax_first_installment?: number | null;
  property_tax_first_installment_due_date?: Date | null;
  property_tax_second_installment?: number | null;
  property_tax_second_installment_due_date?: Date | null;
  iptu_year?: number | null;
  iptu_installments?: unknown;
  iptu_installments_due_dates?: unknown;
  iptu_installments_count?: number | null;
  insurance_company?: string | null;
  insurance_type?: string | null;
  insurance_policy?: string | null;
  guarantors?: Guarantor[] | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  property?: unknown;
  owner?: unknown;
  tenant?: unknown;
  type?: unknown;
  agency?: unknown;
  financial_institution?: unknown;
  documents?: unknown[];
  [key: string]: unknown;
}

/** Dados de criação/atualização de locação (campos crus, como o front envia). */
export interface CreateLeaseData {
  property_id: string;
  type_id: string;
  owner_id: string;
  tenant_id: string;
  agency_id?: string | null;
  financial_institution_id?: string | null;
  contract_number: string;
  start_date: string | Date;
  end_date: string | Date;
  rent_amount: number;
  condo_fee?: number | null;
  property_tax?: number | null;
  extra_charges?: number | null;
  /** Desconto/despesa acordado na locação — abate o valor líquido no Relatório de Locações. */
  discount_amount?: number | null;
  commission_amount?: number | null;
  rent_due_day: number;
  tax_due_day?: number | null;
  condo_due_day?: number | null;
  status?: string;
  payment_condition?: string | null;
  property_tax_cash?: number | null;
  property_tax_cash_due_date?: string | Date | null;
  property_tax_first_installment?: number | null;
  property_tax_first_installment_due_date?: string | Date | null;
  property_tax_second_installment?: number | null;
  property_tax_second_installment_due_date?: string | Date | null;
  iptu_year?: number | null;
  iptu_installments?: number[] | null;
  iptu_installments_due_dates?: (string | null)[] | null;
  iptu_installments_count?: number | null;
  insurance_company?: string | null;
  insurance_type?: string | null;
  insurance_policy?: string | null;
  guarantors?: Guarantor[] | null;
  cancellation_justification?: string | null;
  cancellation_penalty?: number | null;
  other_cancellation_amounts?: number | null;
  canceled_at?: string | Date | null;
}

export type UpdateLeaseData = Partial<CreateLeaseData>;

export interface ListLeasesParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
}

export interface PaginatedLeases {
  data: Lease[];
  count: number;
  totalPages: number;
  currentPage: number;
}

/** Entrada do encargo opcional lançado no cancelamento. */
export interface CancellationChargeInput {
  amount: number;
  category_id: string;
  subcategory_id?: string | null;
  financial_institution_id: string;
  center_id?: string | null;
  supplier_id?: string | null;
  description?: string | null;
  date?: string | null;
  status?: string;
}

/** Entrada da efetivação de cancelamento. */
export interface CancelLeaseInput {
  date: string;
  transactionIds?: string[];
  charge?: CancellationChargeInput | null;
  reason?: string | null;
}

/** Prévia de cancelamento: lançamentos que seriam excluídos. */
export interface CancellationPreview {
  lease: { id: string; contract_number: string; start_date: Date; end_date: Date };
  from: Date;
  to: Date;
  transactions: unknown[];
}

/** Resultado da efetivação do cancelamento. */
export interface CancelLeaseResult {
  lease: Lease;
  deleted: number;
  charge: unknown | null;
}

// ─── LeaseFinanceService (geração automática de lançamentos) ────────────────

/** Item do schedule de lançamentos a gerar (aluguel, comissão, IPTU). */
export interface LeaseScheduleItem {
  category_id: string;
  subcategory_id?: string | null;
  center_id?: string | null;
  amount: number;
  date: Date;
  installment_number: number;
  total: number;
  description: string;
}

/** Resultado da sincronização de lançamentos financeiros da locação. */
export interface SyncLeaseTransactionsResult {
  generated: number;
  warning?: string;
}
