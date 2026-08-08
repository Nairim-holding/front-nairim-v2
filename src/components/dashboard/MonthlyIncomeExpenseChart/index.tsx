'use client';

import { useCallback, useMemo } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useMonthlySummaryMulti } from '@/hooks/useMonthlySummaryMulti';
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
  /** Ano único (compatibilidade). Ignorado quando `years` tem mais de 1 ano. */
  year?: number;
  /** Todos os anos selecionados no Período de análise (Tarefa 1.1 do guia de correções). */
  years?: number[];
  filters?: Record<string, unknown>;
}

/** Largura mínima por mês (px) quando há mais de 1 ano — permite scroll horizontal em vez de espremer o eixo X. */
const MIN_PX_PER_MONTH = 56;

export default function MonthlyIncomeExpenseChart({ year: yearProp, years: yearsProp, filters }: MonthlyIncomeExpenseChartProps) {
  useTheme();
  const tokens = getThemeTokens();

  const years = useMemo(() => {
    if (yearsProp && yearsProp.length > 0) return [...yearsProp].sort((a, b) => a - b);
    return [yearProp ?? new Date().getFullYear()];
  }, [yearsProp, yearProp]);

  const { byYear, isLoading } = useMonthlySummaryMulti(years, filters);

  // Achata todos os anos numa única série contínua de 12*N meses, na ordem do
  // ano mais antigo para o mais recente — é isso que faz o eixo X virar
  // "Jan/2024 ... Dez/2026" em vez de mostrar só o último ano selecionado.
  const flatMonths = useMemo(
    () => years.flatMap((year) => (byYear[year] ?? Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }))).map((m) => ({ ...m, year }))),
    [years, byYear]
  );

  const xAxisLabels = useMemo(
    () => flatMonths.map((m) => (years.length > 1 ? `${MONTH_LABELS[m.month - 1]}/${m.year}` : MONTH_LABELS[m.month - 1])),
    [flatMonths, years.length]
  );

  const detailData = useMemo(
    () => flatMonths.map((m) => ({
      month: years.length > 1 ? `${MONTH_LABELS_FULL[m.month - 1]}/${m.year}` : MONTH_LABELS_FULL[m.month - 1],
      income: m.income,
      expense: m.expense,
    })),
    [flatMonths, years.length]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'month', label: 'Mês' },
      { key: 'income', label: 'Receita', format: (v: number) => formatCurrency(v), summable: true },
      { key: 'expense', label: 'Despesa', format: (v: number) => formatCurrency(v), summable: true },
    ],
    []
  );

  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: getCustomEchartsTooltipConfig((params: any) => {
      const itemsArray = Array.isArray(params) ? params : [params];
      const header = itemsArray[0]?.axisValueLabel || itemsArray[0]?.name || '';
      const items = itemsArray.map((item: any) => ({
        label: item.seriesName || '',
        value: Number(item.value ?? 0),
        color: item.seriesName === 'Receitas' ? tokens.success : tokens.chartSeries[0],
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
        data: flatMonths.map((m) => m.income),
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
        data: flatMonths.map((m) => m.expense),
        lineStyle: { color: tokens.chartSeries[0], width: 3.5 },
        itemStyle: { color: '#ffffff', borderColor: tokens.chartSeries[0], borderWidth: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${tokens.chartSeries[0]}70` },
            { offset: 1, color: `${tokens.chartSeries[0]}05` },
          ]),
        },
      },
    ],
  }), [flatMonths, tokens, xAxisLabels]);

  const subtitle = years.length > 1
    ? `Totais mensais de ${years[0]} a ${years[years.length - 1]}`
    : `Totais mensais de ${years[0]}`;

  // Scroll horizontal (Tarefa 1.1): com vários anos, o eixo X precisa de mais
  // largura que o card para não espremer os rótulos. min-width força o
  // conteúdo a ultrapassar o container quando há mais de 12 meses.
  const minWidthPx = xAxisLabels.length > 12 ? xAxisLabels.length * MIN_PX_PER_MONTH : undefined;

  return (
    <ChartCard
      title="RECEITAS E DESPESAS"
      subtitle={subtitle}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        <div className="w-full h-full overflow-x-auto overflow-y-hidden">
          <div className="h-full relative" style={minWidthPx ? { minWidth: minWidthPx } : { width: '100%' }}>
            <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
          </div>
        </div>
      )}
    </ChartCard>
  );
}
