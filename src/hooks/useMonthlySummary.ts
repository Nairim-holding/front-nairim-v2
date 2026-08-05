'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/utils/authFetch';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

export interface MonthSummary {
  month: number;
  income: number;
  expense: number;
}

function emptyMonths(): MonthSummary[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
}

/** Serializa os filtros do botão Filtro (Tarefa 5.1) na mesma convenção da grid de Lançamentos: chave repetida = seleção múltipla. */
export function appendFilterParams(params: URLSearchParams, filters?: Record<string, unknown>): void {
  if (!filters) return;
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.append(key, String(value));
  });
}

export function useMonthlySummary(year: number, filters?: Record<string, unknown>) {
  const [months, setMonths] = useState<MonthSummary[]>(emptyMonths);
  const [isLoading, setIsLoading] = useState(true);
  const filterKey = JSON.stringify(filters ?? {});

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams({ year: String(year) });
        appendFilterParams(params, filters);
        const response = await authFetch(`${API_URL}/financial-transaction/monthly-summary?${params}`);
        if (response.ok) {
          const result = await response.json();
          if (!cancelled && Array.isArray(result.data?.months)) {
            setMonths(result.data.months);
          }
        }
      } catch (error) {
        console.error('[useMonthlySummary] Erro ao carregar resumo mensal:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, filterKey]);

  return { months, isLoading };
}
