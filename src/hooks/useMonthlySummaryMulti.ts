'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/utils/authFetch';
import { appendFilterParams, type MonthSummary } from './useMonthlySummary';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

function emptyMonths(): MonthSummary[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
}

/**
 * Mesma fonte que useMonthlySummary, mas para VÁRIOS anos ao mesmo tempo
 * (Tarefa 5.2/9, 29/07/26) — um fetch por ano selecionado, em paralelo,
 * indexado por ano para quem precisa comparar/agrupar por ano (o novo
 * gráfico "Receitas VS Despesas por ano") ou somar tudo junto (os tiles de
 * total do cabeçalho do Financeiro).
 */
export function useMonthlySummaryMulti(years: number[], filters?: Record<string, unknown>) {
  const key = [...years].sort((a, b) => a - b).join(',');
  const filterKey = JSON.stringify(filters ?? {});
  const [byYear, setByYear] = useState<Record<number, MonthSummary[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const entries = await Promise.all(
          years.map(async (year) => {
            try {
              const params = new URLSearchParams({ year: String(year) });
              appendFilterParams(params, filters);
              const response = await authFetch(`${API_URL}/financial-transaction/monthly-summary?${params}`);
              if (response.ok) {
                const result = await response.json();
                if (Array.isArray(result.data?.months)) return [year, result.data.months] as const;
              }
            } catch (error) {
              console.error(`[useMonthlySummaryMulti] Erro ao carregar resumo de ${year}:`, error);
            }
            return [year, emptyMonths()] as const;
          })
        );
        if (!cancelled) setByYear(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, filterKey]);

  return { byYear, isLoading };
}
