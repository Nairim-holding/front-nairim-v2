/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface DynamicFilter {
  field: string;
  type: 'string' | 'date' | 'enum' | 'number' | 'boolean' | 'select'; // ADICIONADO 'select'
  label: string;
  description: string;
  searchable?: boolean;
  autocomplete?: boolean;
  inputType?: string;
  values?: any[];
  options?: any[];
  min?: string;
  max?: string;
  dateRange?: boolean;
  multiple?: boolean;
  dependsOn?: { field: string; matchKey: string };
}

export interface FilterOperators {
  string?: string[];
  number?: string[];
  date?: string[];
  boolean?: string[];
  enum?: string[];
  select?: string[]; // ADICIONADO
}

export interface DynamicFiltersResponse {
  filters: DynamicFilter[];
  operators: FilterOperators;
  defaultSort: string;
  searchFields: string[];
}

export const useDynamicFilters = (
  endpoint: string,
  appliedFilters?: Record<string, any>,
  fetcher?: (appliedFilters?: Record<string, any>) => Promise<DynamicFiltersResponse>,
) => {
  const [filters, setFilters] = useState<DynamicFilter[]>([]);
  const [operators, setOperators] = useState<FilterOperators | null>(null);
  const [searchFields, setSearchFields] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const fetchFilters = useCallback(async () => {
    const version = ++requestVersion.current;
    setIsLoading(true);
    setError(null);

    try {
      if (!fetcher) {
        throw new Error('useDynamicFilters: fetcher ausente — filtros requerem Server Action');
      }
      const result = await fetcher(appliedFilters);
      if (version !== requestVersion.current) return;
      const isUsersEndpoint = endpoint.includes('users');
      const filteredFilters = (result.filters || []).filter((filter: DynamicFilter) =>
        isUsersEndpoint ? filter.field !== 'id' && filter.field !== 'role' : true,
      );

      setFilters(filteredFilters);
      setOperators(result.operators || null);
      setSearchFields(result.searchFields || []);
      return;
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('❌ Erro ao carregar filtros:', err);
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [endpoint, appliedFilters, fetcher]);

  useEffect(() => {
    fetchFilters();
    return () => { requestVersion.current += 1; };
  }, [fetchFilters]);

  return {
    filters,
    operators,
    searchFields,
    isLoading,
    error,
    refetch: fetchFilters
  };
};
