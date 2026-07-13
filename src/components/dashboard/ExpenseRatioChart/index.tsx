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
    const sliceColor = isOverBudget ? tokens.error : tokens.warning;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: () => `Despesas: ${ratio}% da Receita`,
      },
      legend: {
        bottom: 0,
        textStyle: { color: tokens.textSecondary, fontSize: isLarge ? 13 : 11 },
      },
      series: [
        {
          type: 'pie',
          radius: isLarge ? '60%' : '68%',
          center: ['50%', '45%'],
          label: {
            show: true,
            position: 'inside',
            formatter: (params: { name: string }) =>
              params.name === 'Despesas' ? `${ratio}%` : `${100 - ratio}%`,
            color: tokens.textInverse,
            fontSize: isLarge ? 16 : 12,
            fontWeight: 'bold',
          },
          labelLine: { show: false },
          itemStyle: { borderColor: tokens.bgSurface, borderWidth: 2 },
          data: [
            { value: despesaSlice, name: 'Despesas', itemStyle: { color: sliceColor } },
            ...(restanteSlice > 0
              ? [{ value: restanteSlice, name: 'Receita restante', itemStyle: { color: tokens.success } }]
              : []),
          ],
        },
      ],
    };
  }, [ratio, isOverBudget, tokens]);

  return (
    <ChartCard
      title="% Despesas em relação às Receitas"
      subtitle={`Mês atual: ${MONTH_LABELS_FULL[currentMonthIndex]} de ${year}`}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        <div className="w-full h-full flex flex-col p-3 gap-2">
          <div className={`text-center rounded-lg py-2 shrink-0 ${isOverBudget ? 'bg-state-error/10' : 'bg-surface-subtle'}`}>
            <div className={`font-bold ${isFullscreen ? 'text-4xl' : 'text-2xl'} ${isOverBudget ? 'text-state-error' : 'text-content'}`}>
              {isOverBudget && !isFullscreen && <span aria-hidden="true">⚠ </span>}
              {ratio}%
            </div>
            {isOverBudget && isFullscreen && (
              <div className="text-xs font-medium text-state-error mt-1">
                ⚠ Despesas ultrapassam a Receita
              </div>
            )}
          </div>
          <div className="flex-1 relative min-h-0">
            <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
          </div>
        </div>
      )}
    </ChartCard>
  );
}
