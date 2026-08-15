'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import Select, { type Option } from '@/components/ui/Select';
import { getSubcategoryBreakdownAction } from '@/server/actions/financial-transaction';
import { listCategoriesAction } from '@/server/actions/financial-category';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { getPeriodRange } from '@/utils/periodRange';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

interface SubcategoryYearValue {
  year: number;
  value: number;
}

interface SubcategoryItem {
  subcategoryId: string | null;
  name: string;
  value: number;
  /** Detalhamento por ano (Tarefa 1.2 do guia de correções) — só preenchido quando o período cobre mais de um ano. */
  byYear?: SubcategoryYearValue[];
}

interface SubcategoryBreakdownChartProps {
  startDate?: string;
  endDate?: string;
  filters?: Record<string, unknown>;
}

/**
 * Detalhamento de Gastos por Subcategorias (Tarefa 7, 29/07/26). Era um
 * gráfico de PIZZA — subcategorias com percentual pequeno ficavam ilegíveis
 * fatiadas. Agora é barras verticais, no mesmo estilo do "Saldo por Conta"
 * (AccountBalanceChart): cada subcategoria é uma barra, valor no topo.
 */
export default function SubcategoryBreakdownChart({ startDate: startDateProp, endDate: endDateProp, filters }: SubcategoryBreakdownChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const fallback = useMemo(() => getPeriodRange(new Date().getFullYear(), [new Date().getMonth() + 1]), []);
  const startDate = startDateProp ?? fallback.startDate;
  const endDate = endDateProp ?? fallback.endDate;
  const filterKey = JSON.stringify(filters ?? {});

  const [categories, setCategories] = useState<Option[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categoryName, setCategoryName] = useState('');
  const [total, setTotal] = useState(0);
  const [subcategories, setSubcategories] = useState<SubcategoryItem[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await listCategoriesAction({
          limit: 100,
          'filter[is_active]': true,
          'filter[type]': 'EXPENSE',
        });
        if (!cancelled && result.ok) {
          const list = Array.isArray(result.data.data) ? result.data.data : [];
          // Ordem alfabética (Tarefa 1.2, Passo 4) — faz "Despesas Fixas" ser a
          // seleção padrão quando existir, sem depender da ordem vinda da API.
          const sorted = [...list].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
          setCategories(sorted.map((c) => ({ label: c.name, value: c.id })));
          if (sorted.length > 0) {
            const defaultCategory = sorted.find((c) => String(c.name).trim().toLowerCase() === 'despesas fixas') ?? sorted[0];
            setSelectedCategoryId(defaultCategory.id);
          }
        }
      } catch (error) {
        console.error('[SubcategoryBreakdownChart] Erro ao carregar categorias:', error);
      } finally {
        if (!cancelled) setIsLoadingCategories(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCategoryId) return;
    let cancelled = false;
    setIsLoadingData(true);

    (async () => {
      try {
        const result = await getSubcategoryBreakdownAction({
          categoryId: selectedCategoryId,
          startDate,
          endDate,
          ...(filters ?? {}),
        });
        if (!cancelled && result.ok) {
          setCategoryName(result.data.categoryName ?? '');
          setTotal(Number(result.data.total ?? 0));
          setSubcategories(Array.isArray(result.data.subcategories) ? result.data.subcategories : []);
        }
      } catch (error) {
        console.error('[SubcategoryBreakdownChart] Erro ao carregar detalhamento:', error);
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, startDate, endDate, filterKey]);

  const percentages = useMemo(
    () => subcategories.map((s) => ({
      ...s,
      percentage: total > 0 ? Math.round((s.value / total) * 1000) / 10 : 0,
    })),
    [subcategories, total]
  );

  // Totalizador vem do rodapé em negrito do DataModal (summable).
  const detailData = useMemo(
    () => subcategories.map((s) => ({ subcategory: s.name, value: s.value })),
    [subcategories]
  );

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
      const subcat = percentages[item.dataIndex];
      const name = subcat?.name || item.name || '';
      const val = subcat?.value ?? Number(item.value ?? 0);
      const pct = subcat?.percentage ?? 0;

      // Múltiplos anos no período: mesma regra do gráfico de Categorias (Tarefa 1.2).
      if (subcat?.byYear && subcat.byYear.length > 1) {
        const yearItems = subcat.byYear.map((y: SubcategoryYearValue) => ({
          label: String(y.year),
          value: y.value,
          color: item.color,
          formattedValue: `${formatCurrency(y.value)} (${val > 0 ? Math.round((y.value / val) * 1000) / 10 : 0}%)`,
        }));
        return buildCustomTooltipHTML(name, [
          ...yearItems,
          { label: 'Total', value: val, color: item.color, formattedValue: `${formatCurrency(val)} (100%)` },
        ]);
      }

      return buildCustomTooltipHTML(name, [
        { label: 'Gasto', value: val, color: item.color, formattedValue: `${formatCurrency(val)} (${pct.toFixed(1)}%)` },
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
      data: percentages.map((s) => s.name),
      axisLabel: {
        color: tokens.textMuted,
        fontSize: isLarge ? 12 : 11,
        rotate: percentages.length > 4 ? 35 : 0,
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
        data: percentages.map((s) => s.value),
        barMaxWidth: 44,
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => `${formatCurrency(Number(p.value))}\n${percentages[p.dataIndex]?.percentage.toFixed(1)}%`,
          fontSize: isLarge ? 11 : 9,
          fontWeight: 'bold',
          color: tokens.textSecondary,
          lineHeight: 14,
        },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: (params: any) => tokens.chartSeries[params.dataIndex % tokens.chartSeries.length],
        },
      },
    ],
  }), [percentages, tokens]);

  return (
    <ChartCard
      title="DETALHAMENTO DE GASTOS POR SUBCATEGORIAS"
      subtitle={categoryName ? `Categoria: ${categoryName} · Total: ${formatCurrency(total)}` : undefined}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        <div className="w-full h-full flex flex-col p-3 gap-2">
          <div className="flex items-center justify-between gap-2 shrink-0 relative z-20">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</span>
            <div className="w-52 sm:w-64">
              <Select
                options={categories}
                value={selectedCategoryId}
                onChange={(v) => setSelectedCategoryId(String(v))}
                placeholder="Selecione uma categoria"
                disabled={isLoadingCategories}
              />
            </div>
          </div>
          {!isLoadingData && subcategories.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-content-muted text-sm text-center px-4">
              Nenhum gasto registrado nesta categoria no período.
            </div>
          ) : (
            <div className="flex-1 relative min-h-0">
              <EchartsSurface
                isFullscreen={isFullscreen}
                isLoading={isLoadingData || isLoadingCategories}
                buildOption={buildOption}
              />
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
