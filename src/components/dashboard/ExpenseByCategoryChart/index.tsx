'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { authFetch } from '@/utils/authFetch';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { formatPeriodLabel, getPeriodRange } from '@/utils/periodRange';
import { appendFilterParams } from '@/hooks/useMonthlySummary';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface CategoryYearValue {
  year: number;
  value: number;
}

interface CategoryExpense {
  categoryId: string;
  name: string;
  value: number;
  /** Detalhamento por ano (Tarefa 1.2 do guia de correções) — só vem preenchido quando o período selecionado cobre mais de um ano. */
  byYear?: CategoryYearValue[];
}

interface ExpenseByCategoryChartProps {
  startDate?: string;
  endDate?: string;
  filters?: Record<string, unknown>;
}

export default function ExpenseByCategoryChart({ startDate: startDateProp, endDate: endDateProp, filters }: ExpenseByCategoryChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const fallback = useMemo(() => getPeriodRange(new Date().getFullYear(), [new Date().getMonth() + 1]), []);
  const startDate = startDateProp ?? fallback.startDate;
  const endDate = endDateProp ?? fallback.endDate;
  const filterKey = JSON.stringify(filters ?? {});

  const [totalIncome, setTotalIncome] = useState(0);
  const [categories, setCategories] = useState<CategoryExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams({ startDate, endDate });
        appendFilterParams(params, filters);
        const response = await authFetch(`${API_URL}/financial-transaction/expense-by-category?${params}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, filterKey]);

  const sortedPercentages = useMemo(() => {
    return categories
      .map((c) => ({
        ...c,
        percentage: totalIncome > 0 ? Math.round((c.value / totalIncome) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [categories, totalIncome]);

  // Totalizador vem do rodapé do DataModal (summable) — não injetar uma linha
  // "Total" manual aqui, senão o rodapé soma o total duas vezes.
  const detailData = useMemo(
    () => categories.map((c) => ({ name: c.name, value: c.value })),
    [categories]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'name', label: 'Categoria' },
      { key: 'value', label: 'Valor', format: (v: number) => formatCurrency(v), summable: true },
    ],
    []
  );

  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: getCustomEchartsTooltipConfig((params: any) => {
      const item = Array.isArray(params) ? params[0] : params;
      const cat = sortedPercentages[item.dataIndex];
      const name = cat?.name || item.name || '';

      // Múltiplos anos no período: detalha valor por ano antes do total
      // (Tarefa 1.2) — "Categoria: X | 2025: R$... (48%) | 2026: R$... (52%) | Total: R$... (100%)".
      if (cat?.byYear && cat.byYear.length > 1) {
        const yearItems = cat.byYear.map((y: CategoryYearValue) => ({
          label: String(y.year),
          value: y.value,
          color: item.color,
          formattedValue: `${formatCurrency(y.value)} (${cat.value > 0 ? Math.round((y.value / cat.value) * 10000) / 100 : 0}%)`,
        }));
        return buildCustomTooltipHTML(name, [
          ...yearItems,
          {
            label: 'Total',
            value: cat.value,
            color: item.color,
            formattedValue: `${formatCurrency(cat.value)} (100%)`,
          },
        ]);
      }

      return buildCustomTooltipHTML(name, [
        {
          label: 'Categorias',
          value: formatCurrency(cat?.value ?? 0),
          color: item.color,
          formattedValue: `${formatCurrency(cat?.value ?? 0)} (${cat?.percentage ?? 0}%)`,
        },
      ]);
    }),
    grid: {
      top: 36,
      bottom: isLarge ? 80 : 60,
      left: 16,
      right: 16,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sortedPercentages.map((c) => c.name),
      axisLabel: {
        color: tokens.textMuted,
        fontSize: isLarge ? 11 : 10,
        fontWeight: 500,
        interval: 0,
        rotate: 40,
      },
      axisLine: { lineStyle: { color: tokens.borderSoft } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      show: false,
    },
    series: [
      {
        type: 'bar',
        data: sortedPercentages.map((c) => c.percentage),
        barMaxWidth: isLarge ? 48 : 36,
        itemStyle: {
          borderRadius: [10, 10, 0, 0],
          color: (params: any) => tokens.chartSeries[params.dataIndex % tokens.chartSeries.length],
        },
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => `${params.value}%`,
          color: tokens.textPrimary,
          fontSize: isLarge ? 11 : 10,
          fontWeight: 'bold',
        },
      },
    ],
  }), [sortedPercentages, tokens]);

  return (
    <ChartCard
      title="% POR CATEGORIA DE GASTO EM RELAÇÃO À RECEITA"
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
          <div className="w-full h-full p-2 relative min-h-0">
            <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
          </div>
        )
      )}
    </ChartCard>
  );
}
