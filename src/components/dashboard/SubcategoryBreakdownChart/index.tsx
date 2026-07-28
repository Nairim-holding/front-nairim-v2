'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import Select, { type Option } from '@/components/ui/Select';
import { authFetch } from '@/utils/authFetch';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { getPeriodRange } from '@/utils/periodRange';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface SubcategoryItem {
  subcategoryId: string | null;
  name: string;
  value: number;
}

interface SubcategoryBreakdownChartProps {
  startDate?: string;
  endDate?: string;
}

export default function SubcategoryBreakdownChart({ startDate: startDateProp, endDate: endDateProp }: SubcategoryBreakdownChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const fallback = useMemo(() => getPeriodRange(new Date().getFullYear(), [new Date().getMonth() + 1]), []);
  const startDate = startDateProp ?? fallback.startDate;
  const endDate = endDateProp ?? fallback.endDate;

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
        const response = await authFetch(
          `${API_URL}/financial-category?limit=1000&filter[is_active]=true&filter[type]=EXPENSE`
        );
        if (response.ok) {
          const result = await response.json();
          const list = Array.isArray(result?.data) ? result.data : [];
          if (!cancelled) {
            setCategories(list.map((c: { id: string; name: string }) => ({ label: c.name, value: c.id })));
            if (list.length > 0) setSelectedCategoryId(list[0].id);
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
        const response = await authFetch(
          `${API_URL}/financial-transaction/subcategory-breakdown?categoryId=${selectedCategoryId}&startDate=${startDate}&endDate=${endDate}`
        );
        if (response.ok) {
          const result = await response.json();
          if (!cancelled) {
            setCategoryName(result.data?.categoryName ?? '');
            setTotal(Number(result.data?.total ?? 0));
            setSubcategories(Array.isArray(result.data?.subcategories) ? result.data.subcategories : []);
          }
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
  }, [selectedCategoryId, startDate, endDate]);

  const percentages = useMemo(
    () => subcategories.map((s) => ({
      ...s,
      percentage: total > 0 ? Math.round((s.value / total) * 1000) / 10 : 0,
    })),
    [subcategories, total]
  );

  const detailData = useMemo(
    () => [
      ...subcategories.map((s) => ({ subcategory: s.name, value: s.value })),
      { subcategory: 'Total', value: total },
    ],
    [subcategories, total]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'subcategory', label: 'Subcategoria' },
      { key: 'value', label: 'Valor', format: (v: number) => formatCurrency(v) },
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
      return buildCustomTooltipHTML(name, [
        { label: 'Gasto', value: val, color: item.color, formattedValue: `${formatCurrency(val)} (${pct.toFixed(1)}%)` },
      ]);
    }),
    title: {
      text: `TOTAL GASTO\n${formatCurrency(total)}`,
      left: '38%',
      top: '42%',
      textAlign: 'center',
      textStyle: {
        color: tokens.textMuted,
        fontSize: isLarge ? 13 : 11,
        fontWeight: 'bold',
        lineHeight: 16,
      },
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'middle',
      icon: 'circle',
      textStyle: {
        color: tokens.textSecondary,
        fontSize: isLarge ? 12 : 11,
        fontWeight: 500,
      },
      itemGap: 8,
    },
    series: [
      {
        type: 'pie',
        radius: isLarge ? ['50%', '76%'] : ['44%', '70%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          position: 'inside',
          formatter: (params: any) => `${params.percent.toFixed(1)}%`,
          color: tokens.textInverse,
          fontSize: isLarge ? 11 : 9,
          fontWeight: 'bold',
        },
        labelLine: { show: false },
        itemStyle: { borderColor: tokens.bgSurface, borderWidth: 2 },
        data: percentages.map((s, idx) => ({
          name: s.name,
          value: s.value,
          itemStyle: { color: tokens.chartSeries[idx % tokens.chartSeries.length] },
        })),
      },
    ],
  }), [percentages, total, tokens]);

  const hasData = !isLoadingData && subcategories.length > 0;

  return (
    <ChartCard
      title="DETALHAMENTO DE GASTOS POR CATEGORIA"
      subtitle={categoryName ? `Categoria: ${categoryName}` : undefined}
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
