'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { getPlanningDashboardAction } from '@/server/actions/planning';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { formatPeriodLabel, getPeriodRange } from '@/utils/periodRange';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

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

/** Anos inteiros cobertos por [startDate, endDate] (ISO), em ordem crescente. */
function yearsInRange(startDate: string, endDate: string): number[] {
  const startYear = new Date(`${startDate}T00:00:00`).getFullYear();
  const endYear = new Date(`${endDate}T00:00:00`).getFullYear();
  if (Number.isNaN(startYear) || Number.isNaN(endYear)) return [];
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y += 1) years.push(y);
  return years;
}

/** [startDate, endDate] do recorte de um ano específico dentro do range original — evita vazar meses de fora do filtro quando o ano é parcial na ponta. */
function clampYearRange(year: number, startDate: string, endDate: string): { startDate: string; endDate: string } {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  return {
    startDate: yearStart > startDate ? yearStart : startDate,
    endDate: yearEnd < endDate ? yearEnd : endDate,
  };
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

  const years = useMemo(() => yearsInRange(startDate, endDate), [startDate, endDate]);
  const isMultiYear = years.length > 1;

  // Com 1 ano: mesma chamada única de sempre. Com >1 ano (Tarefa 1.2): uma
  // chamada por ano (mesmo padrão de useMonthlySummaryMulti), indexada por ano,
  // para a legenda poder discriminar valor por ano + total ao invés de só o
  // acumulado do período inteiro.
  const [categories, setCategories] = useState<CategoryDashboard[]>([]);
  const [categoriesByYear, setCategoriesByYear] = useState<Record<number, CategoryDashboard[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const key = type === 'INCOME' ? 'incomes' : 'expenses';

    (async () => {
      try {
        if (!isMultiYear) {
          const params: Record<string, unknown> = { startDate, endDate, ...(filters ?? {}) };
          const result = await getPlanningDashboardAction(params);
          if (!cancelled && result.ok && Array.isArray(result.data?.[key])) {
            setCategories(result.data[key]);
            setCategoriesByYear({});
          }
          return;
        }

        const results = await Promise.all(
          years.map(async (year) => {
            const range = clampYearRange(year, startDate, endDate);
            const params: Record<string, unknown> = { ...range, ...(filters ?? {}) };
            const result = await getPlanningDashboardAction(params);
            return { year, list: result.ok && Array.isArray(result.data?.[key]) ? result.data[key] : [] };
          })
        );
        if (!cancelled) {
          const map: Record<number, CategoryDashboard[]> = {};
          for (const { year, list } of results) map[year] = list;
          setCategoriesByYear(map);
          setCategories([]);
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
  }, [type, startDate, endDate, filterKey, isMultiYear, years.join(',')]);

  // Primeira linha é o total global da aba (Total de Receitas/Despesas) — não é
  // uma subcategoria em si, mesmo tratamento que RealizedVsPlannedChart já dá.
  const isGlobalTotalRow = (c: CategoryDashboard) =>
    c.id === `${type.toLowerCase()}s-global` || c.name.toLowerCase().startsWith('total de');

  function flattenSubcategories(list: CategoryDashboard[]): { name: string; value: number }[] {
    const out: { name: string; value: number }[] = [];
    for (const cat of list.filter((c) => !isGlobalTotalRow(c))) {
      if (Array.isArray(cat.subcategories) && cat.subcategories.length > 0) {
        for (const sub of cat.subcategories) {
          if (sub.realized_amount > 0) out.push({ name: sub.name, value: sub.realized_amount });
        }
      } else if (cat.realized_amount > 0) {
        out.push({ name: cat.name, value: cat.realized_amount });
      }
    }
    return out;
  }

  const items = useMemo(() => {
    if (!isMultiYear) return flattenSubcategories(categories).sort((a, b) => b.value - a.value);

    // Total por subcategoria somando todos os anos — é o que dita a altura da
    // barra e a ordenação; o detalhamento por ano só aparece no tooltip.
    const totals = new Map<string, number>();
    for (const year of years) {
      for (const { name, value } of flattenSubcategories(categoriesByYear[year] ?? [])) {
        totals.set(name, (totals.get(name) ?? 0) + value);
      }
    }
    return [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, categoriesByYear, isMultiYear, years.join(',')]);

  /** Valor da subcategoria `name` no `year`, ou 0 se não houve lançamento. */
  const valueForYear = useCallback(
    (name: string, year: number) => flattenSubcategories(categoriesByYear[year] ?? []).find((i) => i.name === name)?.value ?? 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoriesByYear]
  );

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
      const name = entry?.name ?? item.name ?? '';
      const total = entry?.value ?? Number(item.value ?? 0);
      const sideLabel = type === 'INCOME' ? 'Receita' : 'Despesa';

      // Múltiplos anos (Tarefa 1.2): uma linha por ano + linha de total, cada
      // uma com o percentual sobre o total da subcategoria — em vez de só o
      // acumulado do período inteiro.
      if (isMultiYear) {
        const pct = (value: number) => (total > 0 ? `${((value / total) * 100).toFixed(2).replace('.', ',')}%` : '0,00%');
        const yearRows = years.map((year) => {
          const value = valueForYear(name, year);
          return {
            label: `${name} - ${year}`,
            value,
            color: item.color,
            formattedValue: `${formatCurrency(value)} (${pct(value)})`,
          };
        });
        return buildCustomTooltipHTML(name, [
          ...yearRows,
          { label: `Total ${name}`, value: total, color: item.color, formattedValue: `${formatCurrency(total)} (${pct(total)})` },
        ]);
      }

      return buildCustomTooltipHTML(name, [
        { label: sideLabel, value: total, color: item.color },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, tokens, type, isMultiYear, years.join(','), valueForYear]);

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
