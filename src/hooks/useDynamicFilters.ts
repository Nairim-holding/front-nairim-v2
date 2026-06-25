/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';

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
  string: string[];
  number: string[];
  date: string[];
  boolean: string[];
  enum: string[];
  select: string[]; // ADICIONADO
}

export interface DynamicFiltersResponse {
  filters: DynamicFilter[];
  operators: FilterOperators;
  defaultSort: string;
  searchFields: string[];
}

export const useDynamicFilters = (endpoint: string, appliedFilters?: Record<string, any>) => {
  const [filters, setFilters] = useState<DynamicFilter[]>([]);
  const [operators, setOperators] = useState<FilterOperators | null>(null);
  const [searchFields, setSearchFields] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFilters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Enviar filtros atuais para o endpoint para obter opções contextuais
      const params = new URLSearchParams();
      
      if (appliedFilters && Object.keys(appliedFilters).length > 0) {
        console.log('📤 Sending applied filters to backend:', appliedFilters);
        
        Object.entries(appliedFilters).forEach(([key, value]) => {
          if (value === undefined || value === null || value === '') return;

          // Filtros multi-seleção: chave repetida, igual ao formato aceito pelo endpoint de listagem
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, String(v)));
          }
          // Para objetos como date ranges
          else if (typeof value === 'object' && value.from && value.to) {
            // Enviar como JSON string para o backend parsear
            params.append(key, JSON.stringify(value));
          }
          // Para valores simples
          else if (typeof value === 'string') {
            params.append(key, value);
          }
        });
      }
      
      const url = `${process.env.NEXT_PUBLIC_URL_API}${endpoint}${
        params.toString() ? `?${params.toString()}` : ''
      }`;
      
      console.log('🔄 Fetching contextual filters from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar filtros');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Filtrar campos indesejados (id e role) se for usuários
        const isUsersEndpoint = endpoint.includes('users');
        const filteredFilters = (data.data.filters || []).filter((filter: DynamicFilter) => 
          isUsersEndpoint 
            ? filter.field !== 'id' && filter.field !== 'role'
            : true
        );
    
        setFilters(filteredFilters);
        setOperators(data.data.operators || null);
        setSearchFields(data.data.searchFields || []);
      } else {
        throw new Error(data.message || 'Erro ao carregar filtros');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('❌ Erro ao carregar filtros:', err);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, appliedFilters]);

  useEffect(() => {
    fetchFilters();
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