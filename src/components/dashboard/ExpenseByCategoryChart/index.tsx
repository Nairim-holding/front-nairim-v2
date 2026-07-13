'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { authFetch } from '@/utils/authFetch';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { formatPeriodLabel, getPeriodRange } from '@/utils/periodRange';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface CategoryExpense {
  categoryId: string;
  name: string;
  value: number;
}

interface ExpenseByCategoryChartProps {
  startDate?: string;
  endDate?: string;
}

export default function ExpenseByCategoryChart({ startDate: startDateProp, endDate: endDateProp }: ExpenseByCategoryChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const fallback = useMemo(() => getPeriodRange(new Date().getFullYear(), [new Date().getMonth() + 1]), []);
  const startDate = startDateProp ?? fallback.startDate;
  const endDate = endDateProp ?? fallback.endDate;

  const [totalIncome, setTotalIncome] = useState(0);
  const [categories, setCategories] = useState<CategoryExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await authFetch(
          `${API_URL}/financial-transaction/expense-by-category?startDate=${startDate}&endDate=${endDate}`
        );
        if (response.ok) {
          const result = await response.json();
          if (!cancelled) {
            setTotalIncome(Number(result.data?.totalIncome ?? 0));
            setCategories(Array.isArray(result.data?.categories) ? result.data.categories : []);
          }
        }
      } catch (error) {
        console.error('[ExpenseByCategoryChart] Erro ao carregar despesas por categoria:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const totalExpense = useMemo(() => categories.reduce((sum, c) => sum + c.value, 0), [categories]);

  const percentages = useMemo(
    () => categories.map((c) => ({
      ...c,
      percentage: totalIncome > 0 ? Math.round((c.value / totalIncome) * 10000) / 100 : 0,
    })),
    [categories, totalIncome]
  );

  const detailData = useMemo(
    () => [
      ...categories.map((c) => ({ name: c.name, value: c.value })),
      { name: 'Total', value: totalExpense },
    ],
    [categories, totalExpense]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'name', label: 'Categoria' },
      { key: 'value', label: 'Valor', format: (v: number) => formatCurrency(v) },
    ],
    []
  );

  const buildOption = useCallback((isLarge: boolean): EChartsOption => {
    // Ordem ascendente: com eixo de categoria normal (não invertido), o maior valor
    // acaba desenhado no topo do gráfico de barras horizontais.
    const sorted = [...percentages].sort((a, b) => a.percentage - b.percentage);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        formatter: (params: any) => {
          const item = Array.isArray(params) ? params[0] : params;
          const cat = sorted[item.dataIndex];
          return `${cat.name}<br/>${cat.percentage}% da Receita<br/>${formatCurrency(cat.value)}`;
        },
      },
      grid: {
        top: 16,
        bottom: 16,
        left: isLarge ? 180 : 130,
        right: 56,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: tokens.textMuted, fontSize: 11, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { type: 'dashed', color: tokens.borderSoft } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((c) => c.name),
        axisLabel: { color: tokens.textMuted, fontSize: isLarge ? 13 : 11 },
        axisLine: { lineStyle: { color: tokens.borderSoft } },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((c) => c.percentage),
          barMaxWidth: 22,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: (params: any) => tokens.chartSeries[params.dataIndex % tokens.chartSeries.length],
          },
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => `${params.value}%`,
            color: tokens.textSecondary,
            fontSize: isLarge ? 13 : 11,
          },
        },
      ],
    };
  }, [percentages, tokens]);

  return (
    <ChartCard
      title="% por Categoria em relação à Receita"
      subtitle={formatPeriodLabel(startDate, endDate)}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        !isLoading && categories.length === 0 ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm">
            Nenhuma despesa registrada no período.
          </div>
        ) : (
          <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
        )
      )}
    </ChartCard>
  );
}
