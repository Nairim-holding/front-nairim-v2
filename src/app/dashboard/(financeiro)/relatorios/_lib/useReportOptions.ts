import { useEffect, useState } from 'react';
import type { ReportOptions } from './types';
import { getReportingOptionsAction } from '@/server/actions/reporting-options';
const EMPTY_OPTIONS: ReportOptions = { institutions: [], cards: [], incomeCategories: [], expenseCategories: [], subcategoriesByCategory: {}, centers: [] };
export function useReportOptions(companyIds: string[]) {
  const [resultState, setResultState] = useState<{ scopeKey: string | null; options: ReportOptions }>({ scopeKey: null, options: EMPTY_OPTIONS });
  const scopeKey = JSON.stringify(companyIds);
  useEffect(() => {
    let cancelled = false;
    getReportingOptionsAction({ company_ids: JSON.parse(scopeKey) }).then(result => {
      if (!cancelled) setResultState({ scopeKey, options: result.ok ? result.data : EMPTY_OPTIONS });
    }).catch(() => { if (!cancelled) setResultState({ scopeKey, options: EMPTY_OPTIONS }); });
    return () => { cancelled = true; };
  }, [scopeKey]);
  return { options: resultState.scopeKey === scopeKey ? resultState.options : EMPTY_OPTIONS, isLoading: resultState.scopeKey !== scopeKey };
}
