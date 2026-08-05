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

interface SubcategoryDashboard {
  id?: string;
  name: string;
  realized_amount: number;
}

interface CategoryDashboard {
  id?: string;
  name: string;
  realized_amount: number;
  subcategories?: SubcategoryDashboard[];
}

interface PlanningSubcategoryBarChartProps {
  /** "Resumo das Receitas" lê `data.incomes`; "Resumo das Despesas" lê `data.expenses`
   * (que já junta Despesas Fixas + Variáveis + Impostos — todas as categorias de despesa). */
  type: 'INCOME' | 'EXPENSE';
  title: string;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, unknown>;
}

/**
 * Novos gráficos "Resumo das Receitas"/"Resumo das Despesas" (Tarefa 8,
 * 29/07/26): barras com o valor REALIZADO de cada subcategoria no período,
 * da fonte já usada por "Despesas: Realizado VS Planejado" (/planning/dashboard
 * já traz TODAS as subcategorias ativas com seu realizado, com ou sem
 * planejamento configurado — não precisa de endpoint novo).
 */
export default function PlanningSubcategoryBarChart({ type, title, startDate: startDateProp, endDate: endDateProp, filters }: PlanningSubcategoryBarChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const fallback = useMemo(() => getPeriodRange(new Date().getFullYear(), [new Date().getMonth() + 1]), []);
  const startDate = startDateProp ?? fallback.startDate;
  const endDate = endDateProp ?? fallback.endDate;
  const filterKey = JSON.stringify(filters ?? {});

  const [categories, setCategories] = useState<CategoryDashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams({ startDate, endDate });
        appendFilterParams(params, filters);
        const response = await authFetch(`${API_URL}/planning/dashboard?${params}`);
        if (response.ok) {
          const result = await response.json();
          const key = type === 'INCOME' ? 'incomes' : 'expenses';
          if (!cancelled && Array.isArray(result.data?.[key])) {
            setCategories(result.data[key]);
          }
        }
      } catch (error) {
        console.error('[PlanningSubcategoryBarChart] Erro ao carregar dados:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, startDate, endDate, filterKey]);

  // Primeira linha é o total global da aba (Total de Receitas/Despesas) — não é
  // uma subcategoria em si, mesmo tratamento que RealizedVsPlannedChart já dá.
  const items = useMemo(() => {
    const list: { name: string; value: number }[] = [];
    const validCategories = categories.filter(
      (c) => c.id !== `${type.toLowerCase()}s-global` && !c.name.toLowerCase().startsWith('total de')
    );

    for (const cat of validCategories) {
      if (Array.isArray(cat.subcategories) && cat.subcategories.length > 0) {
        for (const sub of cat.subcategories) {
          if (sub.realized_amount > 0) list.push({ name: sub.name, value: sub.realized_amount });
        }
      } else if (cat.realized_amount > 0) {
        list.push({ name: cat.name, value: cat.realized_amount });
      }
    }

    return list.sort((a, b) => b.value - a.value);
  }, [categories, type]);

  const periodLabel = formatPeriodLabel(startDate, endDate);

  const detailData = useMemo(() => items.map((i) => ({ subcategory: i.name, value: i.value })), [items]);
  const detailColumns = useMemo(
    () => [
      { key: 'subcategory', label: 'Subcategoria' },
      { key: 'value', label: 'Valor', format: (v: number) => formatCurrency(v), summable: true },
    ],
    []
  );

  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: getCustomEchartsTooltipConfig((params: any) => {
      const item = Array.isArray(params) ? params[0] : params;
      const entry = items[item.dataIndex];
      return buildCustomTooltipHTML(entry?.name ?? item.name ?? '', [
        { label: type === 'INCOME' ? 'Receita' : 'Despesa', value: entry?.value ?? Number(item.value ?? 0), color: item.color },
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
      data: items.map((i) => i.name),
      axisLabel: {
        color: tokens.textMuted,
        fontSize: isLarge ? 12 : 11,
        rotate: items.length > 4 ? 35 : 0,
        interval: 0,
      },
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
        type: 'bar',
        data: items.map((i) => i.value),
        barMaxWidth: 44,
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => formatCurrency(Number(p.value)),
          fontSize: isLarge ? 12 : 10,
          fontWeight: 'bold',
          color: tokens.textSecondary,
        },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: (params: any) => tokens.chartSeries[params.dataIndex % tokens.chartSeries.length],
        },
      },
    ],
  }), [items, tokens, type]);

  return (
    <ChartCard
      title={title}
      subtitle={periodLabel}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        !isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm text-center px-4">
            {type === 'INCOME' ? 'Nenhuma receita registrada no período.' : 'Nenhuma despesa registrada no período.'}
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
