'use client';

import { useEffect, useState } from 'react';
import { getMonthlySummaryMultiAction } from '@/server/actions/financial-transaction';
import { type MonthSummary } from './useMonthlySummary';

function emptyMonths(): MonthSummary[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
}

/**
 * Mesma fonte que useMonthlySummary, mas para VÁRIOS anos ao mesmo tempo
 * (Tarefa 5.2/9, 29/07/26) — uma chamada única para todos os anos
 * (GET /financial-transaction/monthly-summary-multi), indexado por ano para
 * quem precisa comparar/agrupar por ano (o novo gráfico "Receitas VS Despesas
 * por ano") ou somar tudo junto (os tiles de total do cabeçalho do Financeiro).
 */
export function useMonthlySummaryMulti(years: number[], filters?: Record<string, unknown>) {
  const key = [...years].sort((a, b) => a - b).join(',');
  const filterKey = JSON.stringify(filters ?? {});
  const requestKey = `${key}:${filterKey}`;
  const [summary, setSummary] = useState<{ key: string; byYear: Record<number, MonthSummary[]> } | null>(null);
  const isLoading = summary?.key !== requestKey;
  const byYear = isLoading ? {} : summary.byYear;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getMonthlySummaryMultiAction({ years, ...(filters ?? {}) });
        if (!cancelled && result.ok) {
          const map: Record<number, MonthSummary[]> = {};
          for (const entry of result.data) {
            map[entry.year] = Array.isArray(entry.months) ? entry.months : emptyMonths();
          }
          setSummary({ key: requestKey, byYear: map });
        } else if (!cancelled) {
          setSummary({ key: requestKey, byYear: {} });
        }
      } catch (error) {
        console.error('[useMonthlySummaryMulti] Erro ao carregar resumo mensal:', error);
        if (!cancelled) setSummary({ key: requestKey, byYear: {} });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  return { byYear, isLoading };
}
