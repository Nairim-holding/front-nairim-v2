'use client';

import { useEffect, useMemo, useState } from 'react';
import ChartCard from '@/components/dashboard/ChartCard';
import DualColorBarChart, { type DualColorBarItem } from '@/components/dashboard/DualColorBarChart';
import { authFetch } from '@/utils/authFetch';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { formatPeriodLabel, getPeriodRange } from '@/utils/periodRange';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface SubcategoryDashboard {
  id?: string;
  name: string;
  planned_amount: number;
  realized_amount: number;
}

interface CategoryDashboard {
  id?: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  planned_amount: number;
  realized_amount: number;
  subcategories?: SubcategoryDashboard[];
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

  // Remover "Total de Despesas" (global) e extrair subcategorias para o gráfico (Tarefa 7)
  const items: DualColorBarItem[] = useMemo(() => {
    const list: DualColorBarItem[] = [];
    const validCategories = categories.filter(
      (c) => c.id !== 'expenses-global' && !c.name.toLowerCase().includes('total de despesas')
    );

    for (const cat of validCategories) {
      if (Array.isArray(cat.subcategories) && cat.subcategories.length > 0) {
        for (const sub of cat.subcategories) {
          const planned = Number(sub.planned_amount ?? 0);
          const realized = Number(sub.realized_amount ?? 0);
          if (planned > 0 || realized > 0) {
            list.push({
              label: sub.name,
              reference: planned,
              actual: realized,
              percentage: planned > 0 ? Math.round((realized / planned) * 1000) / 10 : 0,
            });
          }
        }
      } else {
        const planned = Number(cat.planned_amount ?? 0);
        const realized = Number(cat.realized_amount ?? 0);
        if (planned > 0 || realized > 0) {
          list.push({
            label: cat.name,
            reference: planned,
            actual: realized,
            percentage: planned > 0 ? Math.round((realized / planned) * 1000) / 10 : 0,
          });
        }
      }
    }

    return list;
  }, [categories]);

  const periodLabel = formatPeriodLabel(startDate, endDate);

  const detailData = useMemo(
    () => items.map((i) => ({
      subcategory: i.label,
      month: periodLabel,
      planned: i.reference,
      realized: i.actual,
      percentage: i.percentage,
    })),
    [items, periodLabel]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'subcategory', label: 'Subcategoria' },
      { key: 'month', label: 'Mês' },
      { key: 'planned', label: 'Planejado', format: (v: number) => formatCurrency(v) },
      { key: 'realized', label: 'Realizado', format: (v: number) => formatCurrency(v) },
      { key: 'percentage', label: 'Percentual', format: (v: number) => `${v.toFixed(1)}%` },
    ],
    []
  );

  return (
    <ChartCard
      title="DESPESAS: REALIZADO VS PLANEJADO"
      subtitle={periodLabel}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {() => (
        isLoading ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm">
            Carregando...
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm">
            Nenhuma despesa registrada no período.
          </div>
        ) : (
          <div className="w-full h-full flex flex-col p-3 overflow-y-auto gap-2.5">
            {items.map((item, index) => {
              const fillWidth = Math.min(item.percentage, 100);
              const isOver = item.percentage > 100;
              return (
                <div key={`${item.label}-${index}`} className="flex items-center gap-3 text-xs">
                  {/* Nome da Categoria / Subcategoria */}
                  <span
                    className="w-28 sm:w-32 shrink-0 font-bold text-slate-700 dark:text-slate-200 truncate"
                    title={item.label}
                  >
                    {item.label}
                  </span>

                  {/* Trilha da Barra de Progresso com Percentual Centralizado */}
                  <div className="flex-1 h-7 rounded-lg bg-[#fdf0e6] dark:bg-slate-800/80 relative overflow-hidden flex items-center justify-center">
                    <div
                      className={`absolute left-0 top-0 bottom-0 rounded-lg transition-all duration-500 ${
                        isOver ? 'bg-brand' : 'bg-brand'
                      }`}
                      style={{ width: `${fillWidth}%` }}
                    />
                    <span
                      className={`relative z-10 font-extrabold text-xs tracking-tight ${
                        fillWidth > 40 ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>

                  {/* Valor Formatado à Direita */}
                  <span
                    className={`w-24 sm:w-28 text-right font-bold text-xs shrink-0 ${
                      isOver ? 'text-brand font-black' : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {formatCurrency(item.actual)}
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}
    </ChartCard>
  );
}
