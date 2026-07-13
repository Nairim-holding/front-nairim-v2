'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/utils/authFetch';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

/** Anos com lançamentos financeiros cadastrados, do mais recente para o mais antigo. */
export function useAvailableYears() {
  const [years, setYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await authFetch(`${API_URL}/financial-transaction/available-years`);
        if (response.ok) {
          const result = await response.json();
          if (!cancelled && Array.isArray(result.data?.years)) {
            setYears(result.data.years);
          }
        }
      } catch (error) {
        console.error('[useAvailableYears] Erro ao carregar anos disponíveis:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { years, isLoading };
}
