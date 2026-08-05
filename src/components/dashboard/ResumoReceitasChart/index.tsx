'use client';

import PlanningSubcategoryBarChart from '@/components/dashboard/PlanningSubcategoryBarChart';

interface ResumoReceitasChartProps {
  startDate?: string;
  endDate?: string;
  filters?: Record<string, unknown>;
}

/** "Resumo das Receitas" (Tarefa 8, 29/07/26): barras com as subcategorias de Receitas. */
export default function ResumoReceitasChart(props: ResumoReceitasChartProps) {
  return <PlanningSubcategoryBarChart type="INCOME" title="RESUMO DAS RECEITAS" {...props} />;
}
