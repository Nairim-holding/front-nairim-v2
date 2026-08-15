'use client';

import { useEffect, useMemo, useState } from 'react';
import ChartCard from '@/components/dashboard/ChartCard';
import { type DualColorBarItem } from '@/components/dashboard/DualColorBarChart';
import RowHoverTooltip from '@/components/dashboard/RowHoverTooltip';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { formatPeriodLabel, getPeriodRange } from '@/utils/periodRange';
import { getCardUsageSummaryAction } from '@/server/actions/financial-card';

interface CardUsage {
  cardId: string;
  name: string;
  limit: number;
  consumed: number;
}

interface CardUsageChartProps {
  startDate?: string;
  endDate?: string;
  filters?: Record<string, unknown>;
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

export default function CardUsageChart({ startDate: startDateProp, endDate: endDateProp, filters }: CardUsageChartProps) {
  const fallback = useMemo(() => getPeriodRange(new Date().getFullYear(), [new Date().getMonth() + 1]), []);
  const startDate = startDateProp ?? fallback.startDate;
  const endDate = endDateProp ?? fallback.endDate;
  const filterKey = JSON.stringify(filters ?? {});
  const [cards, setCards] = useState<CardUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        // Os filtros do grid (chave repetida = múltipla seleção) são convertidos
        // para arrays, mesma convenção do schema da action de uso de cartões.
        const filterArray = (key: string): string[] | undefined => {
          const v = (filters ?? {})[key];
          if (v === undefined || v === null || v === '') return undefined;
          const arr = Array.isArray(v) ? v : [v];
          return arr.length ? arr.map(String) : undefined;
        };

        const result = await getCardUsageSummaryAction({
          startDate,
          endDate,
          category_id: filterArray('category_id'),
          subcategory_id: filterArray('subcategory_id'),
          financial_institution_id: filterArray('financial_institution_id'),
          card_id: filterArray('card_id'),
          center_id: filterArray('center_id'),
          supplier_id: filterArray('supplier_id'),
          description: filterArray('description'),
        });

        if (!cancelled && result.ok && Array.isArray(result.data)) {
          setCards(result.data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, filterKey]);

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
      { key: 'limit', label: 'Limite', format: (v: number) => formatCurrency(v), summable: true },
      { key: 'consumed', label: 'Consumido', format: (v: number) => formatCurrency(v), summable: true },
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
              TOTAL DAS FATURAS: <span className="text-chart-accent font-extrabold">{formatCurrency(totalFaturas)}</span>
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
                  <RowHoverTooltip
                    key={`${item.label}-${index}`}
                    className="flex items-center gap-3 text-xs"
                    title={item.label}
                    rows={[
                      { label: 'Valor do Limite do Cartão', value: formatCurrency(item.reference) },
                      { label: 'Valor Consumido no Cartão', value: formatCurrency(item.actual) },
                    ]}
                  >
                    {/* Ícone de Cartão + Nome */}
                    <div className="flex items-center gap-2 w-32 sm:w-36 shrink-0 min-w-0">
                      <div className="w-6 h-6 rounded bg-chart-accent/15 text-chart-accent dark:bg-chart-accent/25 flex items-center justify-center font-extrabold text-[10px] border border-chart-accent/20 shrink-0">
                        {getCardInitials(item.label)}
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                        {item.label}
                      </span>
                    </div>

                    {/* Trilha da Barra de Progresso com Percentual */}
                    <div className="flex-1 h-7 rounded-lg bg-[#fdf0e6] dark:bg-slate-800/80 relative overflow-hidden flex items-center justify-center">
                      <div
                        className="absolute left-0 top-0 bottom-0 rounded-lg bg-chart-accent transition-all duration-500"
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
                  </RowHoverTooltip>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
