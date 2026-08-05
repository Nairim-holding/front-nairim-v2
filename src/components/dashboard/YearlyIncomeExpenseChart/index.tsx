'use client';

import { useCallback, useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useMonthlySummaryMulti } from '@/hooks/useMonthlySummaryMulti';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

interface YearlyIncomeExpenseChartProps {
  years?: number[];
  filters?: Record<string, unknown>;
}

/**
 * Novo gráfico "Receitas VS Despesas por ano" (Tarefa 9, 29/07/26): barras
 * agrupadas de Receitas/Despesas, uma dupla por ano. Com só 1 ano selecionado
 * no Período de análise, mostra uma única dupla — o mesmo visual da imagem de
 * referência (Tarefa 5.2 é o que permite selecionar mais de um ano).
 */
export default function YearlyIncomeExpenseChart({ years: yearsProp, filters }: YearlyIncomeExpenseChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const years = useMemo(
    () => (yearsProp && yearsProp.length > 0 ? [...yearsProp].sort((a, b) => a - b) : [new Date().getFullYear()]),
    [yearsProp]
  );
  const { byYear, isLoading } = useMonthlySummaryMulti(years, filters);

  const yearTotals = useMemo(
    () => years.map((year) => {
      const months = byYear[year] ?? [];
      const income = months.reduce((sum, m) => sum + m.income, 0);
      const expense = months.reduce((sum, m) => sum + m.expense, 0);
      return { year, income, expense, balance: income - expense };
    }),
    [years, byYear]
  );

  const saldoTotal = useMemo(() => yearTotals.reduce((sum, y) => sum + y.balance, 0), [yearTotals]);

  const detailData = useMemo(
    () => yearTotals.map((y) => ({ year: String(y.year), income: y.income, expense: y.expense, balance: y.balance })),
    [yearTotals]
  );
  const detailColumns = useMemo(
    () => [
      { key: 'year', label: 'Ano' },
      { key: 'income', label: 'Receitas', format: (v: number) => formatCurrency(v), summable: true },
      { key: 'expense', label: 'Despesas', format: (v: number) => formatCurrency(v), summable: true },
      { key: 'balance', label: 'Saldo', format: (v: number) => formatCurrency(v), summable: true },
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
        color: item.color,
      }));
      return buildCustomTooltipHTML(header, items);
    }),
    legend: {
      top: 0,
      right: 0,
      icon: 'circle',
      itemGap: 16,
      textStyle: { color: tokens.textSecondary, fontSize: isLarge ? 12 : 11, fontWeight: 500 },
    },
    grid: {
      top: 40,
      bottom: isLarge ? 40 : 28,
      left: isLarge ? 40 : 10,
      right: isLarge ? 40 : 10,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: yearTotals.map((y) => String(y.year)),
      axisLabel: { color: tokens.textMuted, fontSize: isLarge ? 12 : 11 },
      axisLine: { lineStyle: { color: tokens.borderSoft } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: tokens.textMuted, fontSize: 11, formatter: (value: number) => formatCurrency(value) },
      splitLine: { lineStyle: { type: 'dashed', color: tokens.borderSoft } },
    },
    series: [
      {
        name: 'Receitas',
        type: 'bar',
        barMaxWidth: 48,
        data: yearTotals.map((y) => y.income),
        itemStyle: { borderRadius: [6, 6, 0, 0], color: tokens.chartSeries[1] },
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => formatCurrency(Number(p.value)),
          fontSize: isLarge ? 11 : 9,
          fontWeight: 'bold',
          color: tokens.textSecondary,
        },
      },
      {
        name: 'Despesas',
        type: 'bar',
        barMaxWidth: 48,
        data: yearTotals.map((y) => y.expense),
        itemStyle: { borderRadius: [6, 6, 0, 0], color: tokens.chartSeries[0] },
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => formatCurrency(Number(p.value)),
          fontSize: isLarge ? 11 : 9,
          fontWeight: 'bold',
          color: tokens.textSecondary,
        },
      },
    ],
  }), [yearTotals, tokens]);

  return (
    <ChartCard
      title="RECEITAS VS DESPESAS POR ANO"
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        <div className="w-full h-full flex flex-col p-3 gap-1">
          <div className="flex items-center justify-end shrink-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              SALDO TOTAL{' '}
              <span className={saldoTotal >= 0 ? 'text-state-success' : 'text-state-error'}>
                {formatCurrency(saldoTotal)}
              </span>
            </span>
          </div>
          {!isLoading && yearTotals.every((y) => y.income === 0 && y.expense === 0) ? (
            <div className="flex-1 flex items-center justify-center text-content-muted text-sm text-center px-4">
              Nenhum lançamento registrado no(s) ano(s) selecionado(s).
            </div>
          ) : (
            <div className="flex-1 relative min-h-0">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
