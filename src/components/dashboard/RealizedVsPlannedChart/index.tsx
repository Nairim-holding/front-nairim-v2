'use client';

import { useEffect, useMemo, useState } from 'react';
import ChartCard from '@/components/dashboard/ChartCard';
import DualColorBarChart, { type DualColorBarItem } from '@/components/dashboard/DualColorBarChart';
import { authFetch } from '@/utils/authFetch';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { formatPeriodLabel, getPeriodRange } from '@/utils/periodRange';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface CategoryDashboard {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  planned_amount: number;
  realized_amount: number;
}

interface RealizedVsPlannedChartProps {
  startDate?: string;
  endDate?: string;
}

export default function RealizedVsPlannedChart({ startDate: startDateProp, endDate: endDateProp }: RealizedVsPlannedChartProps) {
  const fallback = useMemo(() => getPeriodRange(new Date().getFullYear(), [new Date().getMonth() + 1]), []);
  const startDate = startDateProp ?? fallback.startDate;
  const endDate = endDateProp ?? fallback.endDate;
  const [categories, setCategories] = useState<CategoryDashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await authFetch(`${API_URL}/planning/dashboard?startDate=${startDate}&endDate=${endDate}`);
        if (response.ok) {
          const result = await response.json();
          if (!cancelled && Array.isArray(result.data?.expenses)) {
            setCategories(result.data.expenses);
          }
        }
      } catch (error) {
        console.error('[RealizedVsPlannedChart] Erro ao carregar planejamento:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  // Só entram categorias com planejamento definido: "realizado x planejado" não
  // faz sentido para uma categoria sem plano (percentual ficaria enganosamente 0%
  // mesmo havendo gasto real).
  const items: DualColorBarItem[] = useMemo(
    () => categories
      .filter((c) => c.planned_amount > 0)
      .map((c) => ({
        label: c.name,
        reference: c.planned_amount,
        actual: c.realized_amount,
        percentage: Math.round((c.realized_amount / c.planned_amount) * 1000) / 10,
      })),
    [categories]
  );

  const periodLabel = formatPeriodLabel(startDate, endDate);

  const detailData = useMemo(
    () => items.map((i) => ({
      category: i.label,
      month: periodLabel,
      planned: i.reference,
      realized: i.actual,
      percentage: i.percentage,
    })),
    [items, periodLabel]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'category', label: 'Categoria' },
      { key: 'month', label: 'Mês' },
      { key: 'planned', label: 'Planejado', format: (v: number) => formatCurrency(v) },
      { key: 'realized', label: 'Realizado', format: (v: number) => formatCurrency(v) },
      { key: 'percentage', label: 'Percentual', format: (v: number) => `${v.toFixed(1)}%` },
    ],
    []
  );

  return (
    <ChartCard
      title="Despesas: Realizado x Planejado"
      subtitle={periodLabel}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        !isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm">
            Nenhuma categoria com planejamento configurado neste período.
          </div>
        ) : (
          <DualColorBarChart
            items={items}
            referenceLabel="Planejado"
            actualLabel="Realizado"
            isFullscreen={isFullscreen}
            isLoading={isLoading}
            valueFormatter={formatCurrency}
          />
        )
      )}
    </ChartCard>
  );
}
