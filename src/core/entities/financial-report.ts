/**
 * Entidades dos Relatórios Financeiros (grouped/extrato/income-expense/
 * demonstrativo). Porte de api-nairim-v2/src/services/ReportService.ts.
 *
 * ⚠️ Nome de arquivo deliberadamente SINGULAR em todas as camadas
 * (`financial-report.ts`, nunca `financial-reports.ts`) — já existe
 * `server/queries/financial-reports.ts` e `shared/validators/financial-reports.ts`
 * de outro recurso (agregações do Dashboard/TransactionController: monthly-
 * summary, expense-by-category etc.), sem sobreposição de rota. Usar o plural
 * aqui colidiria com esses arquivos.
 *
 * Camada: core.
 */

export type ReportRegime = 'caixa' | 'competencia';
export type ReportGroupBy = 'description' | 'day' | 'category' | 'subcategory' | 'contact' | 'center';
export type DfcGroupBy = 'day' | 'subcategory';
export type ReportStatus = 'PENDING' | 'COMPLETED';
export type ReportType = 'INCOME' | 'EXPENSE';

export interface ReportParams {
  startDate: string;
  endDate: string;
  regime?: ReportRegime;
  status?: ReportStatus;
  type?: ReportType;
  /** Filtros multi-seleção já normalizados para array de strings. */
  filters?: Record<string, string[]>;
}

export interface ReportItem {
  id: string;
  description: string;
  amount: number;
  event_date: Date;
  effective_date: Date;
  status: string;
  category: { id: string; name: string } | null;
  subcategory: { id: string; name: string } | null;
  /** camelCase deliberado — mesmo shape que o backend original devolvia (mapItem). */
  financialInstitution: { id: string; name: string } | null;
  card: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  center: { id: string; name: string } | null;
}

export interface ReportGroup {
  key: string;
  label: string;
  total: number;
  count: number;
  items: ReportItem[];
}

export interface GroupedReportResult {
  groups: ReportGroup[];
  totalGeral: number;
}

export interface ExtratoItem extends ReportItem {
  credit: number;
  debit: number;
  balance: number;
}

export interface ReportSummary {
  saldoAnterior: number;
  totalReceitas: number;
  totalDespesas: number;
  balancoPeriodo: number;
  saldoFinal: number;
}

export interface ExtratoResult {
  items: ExtratoItem[];
  summary: ReportSummary;
}

export interface IncomeExpenseSide {
  groups: Array<{ categoryId: string; category: string; total: number; count: number; items: ReportItem[] }>;
  total: number;
}

export interface IncomeExpenseResult {
  receitas: IncomeExpenseSide;
  despesas: IncomeExpenseSide;
  /** Mesmo shape do Resumo do Extrato — mesmo Saldo Anterior/Final, por decisão de negócio do backend original. */
  summary: ReportSummary;
}

export type DfcLineKind = 'line' | 'subtotal' | 'final';

export interface DfcLine {
  key: string;
  label: string;
  kind: DfcLineKind;
  sign: 1 | -1;
  total: number;
  groups: ReportGroup[];
}

export interface DemonstrativoResult {
  groupBy: DfcGroupBy;
  lines: DfcLine[];
  /** Despesas cuja categoria não tem `dfc_group` — entram na linha "Outras Despesas (sem classificação DFC)"; este total serve para o front avisar o usuário. */
  unclassifiedExpenseTotal: number;
  /**
   * Quais categorias precisam ser classificadas, com quanto cada uma pesa no
   * período. Só o total não dizia ONDE mexer: o usuário tinha que abrir uma a
   * uma em Categorias para descobrir quais estavam sem `dfc_group`.
   */
  unclassifiedExpenseCategories: { id: string; name: string; total: number }[];
}
