'use client';

import { useEffect, useMemo, useState } from 'react';
import ChartCard from '@/components/dashboard/ChartCard';
import DualColorBarChart, { type DualColorBarItem } from '@/components/dashboard/DualColorBarChart';
import { authFetch } from '@/utils/authFetch';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { formatPeriodLabel, getPeriodRange } from '@/utils/periodRange';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface CardUsage {
  cardId: string;
  name: string;
  limit: number;
  consumed: number;
}

interface CardUsageChartProps {
  startDate?: string;
  endDate?: string;
}

export default function CardUsageChart({ startDate: startDateProp, endDate: endDateProp }: CardUsageChartProps) {
  const fallback = useMemo(() => getPeriodRange(new Date().getFullYear(), [new Date().getMonth() + 1]), []);
  const startDate = startDateProp ?? fallback.startDate;
  const endDate = endDateProp ?? fallback.endDate;
  const [cards, setCards] = useState<CardUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await authFetch(`${API_URL}/financial-card/usage?startDate=${startDate}&endDate=${endDate}`);
        if (response.ok) {
          const result = await response.json();
          if (!cancelled && Array.isArray(result.data)) {
            setCards(result.data);
          }
        }
      } catch (error) {
        console.error('[CardUsageChart] Erro ao carregar uso dos cartões:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  // Só entram cartões com limite configurado: percentual sobre limite não faz
  // sentido para um cartão sem limite definido.
  const items: DualColorBarItem[] = useMemo(
    () => cards
      .filter((c) => c.limit > 0)
      .map((c) => ({
        label: c.name,
        reference: c.limit,
        actual: c.consumed,
        percentage: Math.round((c.consumed / c.limit) * 1000) / 10,
      })),
    [cards]
  );

  const periodLabel = formatPeriodLabel(startDate, endDate);

  const detailData = useMemo(
    () => items.map((i) => ({
      card: i.label,
      limit: i.reference,
      consumed: i.actual,
      percentage: i.percentage,
    })),
    [items]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'card', label: 'Cartão' },
      { key: 'limit', label: 'Limite', format: (v: number) => formatCurrency(v) },
      { key: 'consumed', label: 'Consumido', format: (v: number) => formatCurrency(v) },
      { key: 'percentage', label: 'Percentual', format: (v: number) => `${v.toFixed(1)}%` },
    ],
    []
  );

  return (
    <ChartCard
      title="Gastos com Cartões"
      subtitle={periodLabel}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        !isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm">
            Nenhum cartão com limite configurado.
          </div>
        ) : (
          <DualColorBarChart
            items={items}
            referenceLabel="Limite"
            actualLabel="Consumido"
            isFullscreen={isFullscreen}
            isLoading={isLoading}
            valueFormatter={formatCurrency}
          />
        )
      )}
    </ChartCard>
  );
}
