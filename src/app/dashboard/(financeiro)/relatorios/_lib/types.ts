export type ReportRegime = 'caixa' | 'competencia';
export type ReportGroupBy = 'description' | 'day' | 'category' | 'subcategory' | 'contact' | 'center';
export type ReportTypeFilter = 'all' | 'INCOME' | 'EXPENSE';
export type ReportStatusFilter = 'all' | 'PENDING' | 'COMPLETED';
export type ReportKind = 'sintetico' | 'analitico';

export interface ReportItemRow {
  id: string;
  description: string;
  amount: number;
  event_date: string;
  effective_date: string;
  status: string;
  category: { id: string; name: string } | null;
  subcategory: { id: string; name: string } | null;
  financialInstitution: { id: string; name: string } | null;
  card: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  center: { id: string; name: string } | null;
}

export interface ReportGroupRow {
  key: string;
  label: string;
  total: number;
  count: number;
  items: ReportItemRow[];
}

export interface GroupedReportResponse {
  groups: ReportGroupRow[];
  totalGeral: number;
}

export interface ExtratoItemRow extends ReportItemRow {
  credit: number;
  debit: number;
  balance: number;
}

export interface ExtratoSummary {
  saldoAnterior: number;
  totalReceitas: number;
  totalDespesas: number;
  balancoPeriodo: number;
  saldoFinal: number;
}

export interface ExtratoResponse {
  items: ExtratoItemRow[];
  summary: ExtratoSummary;
}

export interface IncomeExpenseSide {
  groups: Array<{ categoryId: string; category: string; total: number; count: number; items: ReportItemRow[] }>;
  total: number;
}

export interface IncomeExpenseResponse {
  receitas: IncomeExpenseSide;
  despesas: IncomeExpenseSide;
  /** Mesmo formato do Resumo do Extrato (saldoAnterior/saldoFinal inclusive). */
  summary: ExtratoSummary;
}

export interface ReportFiltersState {
  type: ReportTypeFilter;
  financial_institution_id: string[];
  includeInactiveInstitutions: boolean;
  card_id: string[];
  category_id: string[];
  subcategory_id: string[];
  center_id: string[];
  status: ReportStatusFilter;
}

export const EMPTY_FILTERS: ReportFiltersState = {
  type: 'all',
  financial_institution_id: [],
  includeInactiveInstitutions: false,
  card_id: [],
  category_id: [],
  subcategory_id: [],
  center_id: [],
  status: 'all',
};

export type ReportSection = 'despesas' | 'receitas' | 'fluxo';
export type FluxoItemKey = 'extrato' | 'income-expense' | 'demonstrativo';

export interface SelectedReport {
  section: ReportSection;
  /** groupBy (despesas/receitas) ou FluxoItemKey (fluxo) */
  item: ReportGroupBy | FluxoItemKey;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface CenterOption extends SelectOption {
  type: 'INCOME' | 'EXPENSE';
}

export interface InstitutionOption extends SelectOption {
  isActive: boolean;
}

/** Handle comum exposto pelas views (Grouped/Extrato/IncomeExpense) para a toolbar de exportação. */
export interface ReportViewHandle {
  getTableElement: () => HTMLTableElement | null;
  /** Bloco de resumo (Saldo Anterior/Total Receitas/Total Despesas/Saldo Final), fora da tabela — usado só na impressão. Views sem resumo (Grouped/Demonstrativo) podem omitir. */
  getSummaryElement?: () => HTMLElement | null;
}

export interface ReportOptions {
  institutions: InstitutionOption[];
  cards: SelectOption[];
  incomeCategories: SelectOption[];
  expenseCategories: SelectOption[];
  subcategoriesByCategory: Record<string, SelectOption[]>;
  centers: CenterOption[];
}
