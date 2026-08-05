'use client';

import PlanningSubcategoryBarChart from '@/components/dashboard/PlanningSubcategoryBarChart';

interface ResumoDespesasChartProps {
  startDate?: string;
  endDate?: string;
  filters?: Record<string, unknown>;
}

/** "Resumo das Despesas" (Tarefa 8, 29/07/26): barras com as subcategorias de
 * TODAS as categorias de despesa (Fixas, Variáveis e Impostos combinadas). */
export default function ResumoDespesasChart(props: ResumoDespesasChartProps) {
  return <PlanningSubcategoryBarChart type="EXPENSE" title="RESUMO DAS DESPESAS" {...props} />;
}
