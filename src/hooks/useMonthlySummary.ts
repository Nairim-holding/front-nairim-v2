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

export function useMonthlySummary(year: number) {
  const [months, setMonths] = useState<MonthSummary[]>(emptyMonths);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await authFetch(`${API_URL}/financial-transaction/monthly-summary?year=${year}`);
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
  }, [year]);

  return { months, isLoading };
}
