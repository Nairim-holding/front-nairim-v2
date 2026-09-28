import type { ChartCardColumn } from '@/components/dashboard/ChartCard';
import type { FinancialChartDetailQuery } from '@/core/entities/financial-chart-detail';
import { getFinancialChartDetailsAction } from '@/server/actions/financial-transaction';
import { displayDate } from '@/shared/utils/date-utils';

export const FINANCIAL_DETAIL_COLUMNS: ChartCardColumn[] = [
  { key: 'eventDate', label: 'Competência', format: displayDate },
  { key: 'effectiveDate', label: 'Data efetiva', format: displayDate },
  { key: 'description', label: 'Descrição' },
  { key: 'value', label: 'Valor', summable: true,
    format: (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
  { key: 'type', label: 'Tipo' },
  { key: 'category', label: 'Categoria' },
  { key: 'subcategory', label: 'Subcategoria' },
  { key: 'institution', label: 'Conta' },
  { key: 'card', label: 'Cartão' },
  { key: 'supplier', label: 'Contato' },
  { key: 'center', label: 'Centro' },
  { key: 'status', label: 'Status', format: (value: string) => ({
    COMPLETED: 'Concluído', PENDING: 'Pendente', CANCELED: 'Cancelado',
  }[value] ?? value) },
];

export async function loadFinancialChartDetails(query: FinancialChartDetailQuery, filters?: Record<string, unknown>) {
  const result = await getFinancialChartDetailsAction(query, filters);
  if (!result.ok) throw new Error(result.error || 'Não foi possível carregar os lançamentos.');
  return result.data;
}
