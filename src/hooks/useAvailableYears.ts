'use client';

import { useEffect, useState } from 'react';
import { getAvailableYearsAction } from '@/server/actions/financial-transaction';
import { useReportingCompanies } from '@/components/reports/ReportingCompanies';

/** Anos com lançamentos financeiros cadastrados, do mais recente para o mais antigo. */
export function useAvailableYears() {
  const { companyIds } = useReportingCompanies();
  const scopeKey = JSON.stringify(companyIds);
  const [years, setYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const result = await getAvailableYearsAction({ company_ids: JSON.parse(scopeKey) });
        if (!cancelled && result.ok && Array.isArray(result.data.years)) {
          setYears(result.data.years);
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
  }, [scopeKey]);

  return { years, isLoading };
}
