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

function getCardInitials(name: string): string {
  if (!name) return 'CR';
  const clean = name.replace(/^(Cartão|Visa|Mastercard|Elo|Amex|Hipercard)\s+/i, '').trim();
  const target = clean || name;
  const parts = target.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return target.slice(0, 2).toUpperCase();
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

  const totalFaturas = useMemo(
    () => cards.reduce((sum, c) => sum + c.consumed, 0),
    [cards]
  );

  return (
    <ChartCard
      title="GASTOS COM CARTÕES DE CRÉDITO"
      subtitle={periodLabel}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {() => (
        <div className="w-full h-full flex flex-col p-3">
          {/* Header com Total das Faturas (Imagem 4 & 5) */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-ui-border-soft shrink-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              CARTÕES DE CRÉDITO
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
              TOTAL DAS FATURAS: <span className="text-brand font-extrabold">{formatCurrency(totalFaturas)}</span>
            </span>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-content-muted text-sm">
              Carregando...
            </div>
          ) : items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-content-muted text-sm">
              Nenhum cartão com limite configurado.
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto min-h-0">
              {items.map((item, index) => {
                const fillWidth = Math.min(item.percentage, 100);
                return (
                  <div key={`${item.label}-${index}`} className="flex items-center gap-3 text-xs">
                    {/* Ícone de Cartão + Nome */}
                    <div className="flex items-center gap-2 w-32 sm:w-36 shrink-0 min-w-0">
                      <div className="w-6 h-6 rounded bg-brand/15 text-brand dark:bg-brand/25 dark:text-brand-light flex items-center justify-center font-extrabold text-[10px] border border-brand/20 shrink-0">
                        {getCardInitials(item.label)}
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate" title={item.label}>
                        {item.label}
                      </span>
                    </div>

                    {/* Trilha da Barra de Progresso com Percentual */}
                    <div className="flex-1 h-7 rounded-lg bg-[#fdf0e6] dark:bg-slate-800/80 relative overflow-hidden flex items-center justify-center">
                      <div
                        className="absolute left-0 top-0 bottom-0 rounded-lg bg-brand transition-all duration-500"
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

                    {/* Valor Consumido à Direita */}
                    <span className="w-24 sm:w-28 text-right font-extrabold text-xs text-slate-800 dark:text-slate-100 shrink-0">
                      {formatCurrency(item.actual)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
