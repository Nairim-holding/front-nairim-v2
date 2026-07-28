'use client';

import { useCallback, useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useMonthlySummary } from '@/hooks/useMonthlySummary';
import { MONTH_LABELS_FULL, formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';

interface ExpenseRatioChartProps {
  year?: number;
  endDate?: string;
}

export default function ExpenseRatioChart({ year: yearProp, endDate }: ExpenseRatioChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const now = useMemo(() => new Date(), []);
  const year = yearProp ?? now.getFullYear();
  // Mês de referência: o mais recente do período selecionado no filtro (fim do
  // intervalo), caindo para o mês corrente quando nenhum período é informado.
  const currentMonthIndex = endDate ? new Date(`${endDate}T00:00:00`).getMonth() : now.getMonth();
  const { months, isLoading } = useMonthlySummary(year);

  const currentMonth = months[currentMonthIndex];
  const ratio = currentMonth && currentMonth.income > 0
    ? Math.round((currentMonth.expense / currentMonth.income) * 100)
    : 0;
  const isOverBudget = ratio > 100;

  const detailData = useMemo(
    () => months.map((m) => ({
      month: MONTH_LABELS_FULL[m.month - 1],
      income: m.income,
      expense: m.expense,
    })),
    [months]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'month', label: 'Mês' },
      { key: 'income', label: 'Receita', format: (v: number) => formatCurrency(v) },
      { key: 'expense', label: 'Despesa', format: (v: number) => formatCurrency(v) },
    ],
    []
  );

  const buildOption = useCallback((isLarge: boolean): EChartsOption => {
    const despesaSlice = Math.min(ratio, 100);
    const restanteSlice = Math.max(100 - ratio, 0);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => `${params.name}: ${params.value}%`,
      },
      title: {
        text: `${ratio}%`,
        left: 'center',
        top: '38%',
        textStyle: {
          color: tokens.textPrimary,
          fontSize: isLarge ? 52 : 40,
          fontWeight: 'bold',
        },
      },
      series: [
        {
          type: 'pie',
          radius: isLarge ? ['56%', '84%'] : ['50%', '76%'],
          center: ['50%', '48%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderColor: tokens.bgSurface, borderWidth: 3 },
          data: [
            {
              value: despesaSlice,
              name: 'Despesas',
              itemStyle: { color: isOverBudget ? tokens.error : tokens.brandPrimary },
            },
            ...(restanteSlice > 0
              ? [
                  {
                    value: restanteSlice,
                    name: 'Receita Restante',
                    itemStyle: { color: tokens.bgSubtle },
                  },
                ]
              : []),
          ],
        },
      ],
    };
  }, [ratio, isOverBudget, tokens]);

  return (
    <ChartCard
      title="% DESPESAS EM RELAÇÃO ÀS RECEITAS"
      subtitle={`Mês atual: ${MONTH_LABELS_FULL[currentMonthIndex]} de ${year}`}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        <div className="w-full h-full p-2 relative flex flex-col justify-between items-center">
          <div className="w-full flex-1 relative min-h-0">
            <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
          </div>

          {/* Note card (Image 4) */}
          <div className="absolute bottom-2 right-2 max-w-[210px] p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-[11px] font-semibold text-slate-600 shadow-sm leading-tight text-center z-10 pointer-events-none">
            {isOverBudget
              ? 'Suas despesas foram superiores à receita deste mês. Revise seus gastos para economizar no próximo mês!'
              : 'Suas despesas estão dentro do limite da receita deste mês.'}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
