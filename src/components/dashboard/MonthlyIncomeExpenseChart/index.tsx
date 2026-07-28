'use client';

import { useCallback, useMemo } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useMonthlySummary } from '@/hooks/useMonthlySummary';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

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

  const xAxisLabels = useMemo(() => MONTH_LABELS.map((m) => `${m} ${year}`), [year]);

  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: getCustomEchartsTooltipConfig((params: any) => {
      const itemsArray = Array.isArray(params) ? params : [params];
      const header = itemsArray[0]?.axisValueLabel || itemsArray[0]?.name || '';
      const items = itemsArray.map((item: any) => ({
        label: item.seriesName || '',
        value: Number(item.value ?? 0),
        color: item.seriesName === 'Receitas' ? tokens.success : tokens.brandPrimary,
      }));
      return buildCustomTooltipHTML(header, items);
    }),
    legend: {
      show: false,
    },
    grid: {
      top: 24,
      bottom: isLarge ? 48 : 36,
      left: isLarge ? 90 : 75,
      right: 20,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: xAxisLabels,
      axisLabel: {
        color: tokens.textMuted,
        fontSize: isLarge ? 11 : 10,
        rotate: 35,
        interval: 0,
      },
      axisLine: { lineStyle: { color: tokens.borderSoft } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: tokens.textMuted,
        fontSize: 10,
        formatter: (value: number) => formatCurrency(value),
      },
      splitLine: { lineStyle: { type: 'dashed', color: tokens.borderSoft } },
    },
    series: [
      {
        name: 'Receitas',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 10,
        data: months.map((m) => m.income),
        lineStyle: { color: tokens.success, width: 3.5 },
        itemStyle: { color: '#ffffff', borderColor: tokens.success, borderWidth: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${tokens.success}70` },
            { offset: 1, color: `${tokens.success}05` },
          ]),
        },
      },
      {
        name: 'Despesas',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 10,
        data: months.map((m) => m.expense),
        lineStyle: { color: tokens.brandPrimary, width: 3.5 },
        itemStyle: { color: '#ffffff', borderColor: tokens.brandPrimary, borderWidth: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${tokens.brandPrimary}70` },
            { offset: 1, color: `${tokens.brandPrimary}05` },
          ]),
        },
      },
    ],
  }), [months, tokens, xAxisLabels]);

  return (
    <ChartCard
      title="RECEITAS E DESPESAS"
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
