'use client';

import { useCallback, useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useMonthlySummary } from '@/hooks/useMonthlySummary';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MONTH_LABELS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface MonthlyIncomeExpenseChartProps {
  year?: number;
}

export default function MonthlyIncomeExpenseChart({ year: yearProp }: MonthlyIncomeExpenseChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const year = yearProp ?? new Date().getFullYear();
  const { months, isLoading } = useMonthlySummary(year);

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

  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      confine: true,
      valueFormatter: (value) => formatCurrency(Number(value)),
    },
    legend: {
      data: ['Receitas', 'Despesas'],
      top: 0,
      textStyle: { color: tokens.textSecondary },
    },
    grid: {
      top: 36,
      bottom: isLarge ? 32 : 24,
      left: isLarge ? 64 : 44,
      right: 16,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: MONTH_LABELS,
      axisLabel: { color: tokens.textMuted, fontSize: isLarge ? 13 : 11 },
      axisLine: { lineStyle: { color: tokens.borderSoft } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: tokens.textMuted,
        fontSize: 11,
        formatter: (value: number) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)),
      },
      splitLine: { lineStyle: { type: 'dashed', color: tokens.borderSoft } },
    },
    series: [
      {
        name: 'Receitas',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: months.map((m) => m.income),
        lineStyle: { color: tokens.success, width: 2 },
        itemStyle: { color: tokens.success },
      },
      {
        name: 'Despesas',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: months.map((m) => m.expense),
        lineStyle: { color: tokens.warning, width: 2 },
        itemStyle: { color: tokens.warning },
      },
    ],
  }), [months, tokens]);

  return (
    <ChartCard
      title="Receitas x Despesas"
      subtitle={`Totais mensais de ${year}`}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
      )}
    </ChartCard>
  );
}
