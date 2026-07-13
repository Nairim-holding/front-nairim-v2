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
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (params: any) => `${params.name} — ${formatCurrency(percentages[params.dataIndex]?.value ?? 0)}`,
    },
    series: [
      {
        type: 'pie',
        radius: isLarge ? ['42%', '68%'] : ['38%', '62%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          formatter: (params: any) => `${params.name}\n${(percentages[params.dataIndex]?.percentage ?? 0).toFixed(1)}%`,
          color: tokens.textSecondary,
          fontSize: isLarge ? 13 : 10,
        },
        labelLine: { show: true, length: isLarge ? 16 : 8, length2: isLarge ? 12 : 6 },
        itemStyle: { borderColor: tokens.bgSurface, borderWidth: 2 },
        data: percentages.map((s, idx) => ({
          name: s.name,
          value: s.value,
          itemStyle: { color: tokens.chartSeries[idx % tokens.chartSeries.length] },
        })),
      },
    ],
  }), [percentages, tokens]);

  const hasData = !isLoadingData && subcategories.length > 0;

  return (
    <ChartCard
      title="Gastos por Subcategoria"
      subtitle={categoryName ? `Categoria: ${categoryName}` : undefined}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        <div className="w-full h-full flex flex-col p-3 gap-2">
          <div className="shrink-0">
            <Select
              options={categories}
              value={selectedCategoryId}
              onChange={(v) => setSelectedCategoryId(String(v))}
              placeholder="Selecione uma categoria"
              disabled={isLoadingCategories}
            />
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
              {hasData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className={`font-bold ${isFullscreen ? 'text-2xl' : 'text-base'} text-content`}>
                    {formatCurrency(total)}
                  </div>
                  <div className="text-xs text-content-muted">Total</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
