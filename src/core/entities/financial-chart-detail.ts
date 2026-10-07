import type { TransactionEntityFilters } from './financial-transaction';
import type { ReportRegime } from './financial-report';

/** Cada fonte mantém as mesmas datas e regras usadas no valor do gráfico. */
export interface FinancialChartDetailQuery {
  source: 'transactions' | 'planning' | 'cards' | 'balance';
  regime?: ReportRegime;
  startDate?: string;
  endDate?: string;
  type?: 'INCOME' | 'EXPENSE';
  /** IDs exatos dos centros que compõem a barra; null representa Sem centro. */
  centerIds?: (string | null)[];
  status?: 'COMPLETED' | 'PENDING';
  categoryId?: string;
  subcategoryId?: string | null;
  cardId?: string;
  institutionId?: string;
  /** Composição de um saldo: receitas positivas, despesas negativas. */
  net?: boolean;
}

export interface FinancialChartDetailRow {
  id: string;
  eventDate: string;
  effectiveDate: string;
  description: string;
  type: string;
  category: string;
  subcategory: string;
  institution: string;
  card: string;
  supplier: string;
  center: string;
  status: string;
  value: number;
}

export interface FinancialChartDetailsRepository {
  getChartDetails(query: FinancialChartDetailQuery, filters: TransactionEntityFilters): Promise<FinancialChartDetailRow[]>;
}
