/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/useOptimizedTableData.ts
"use client";

import { useState, useCallback, useEffect } from 'react';

interface TableState {
  page: number;
  limit: number;
  search: string;
  sort: Record<string, any>;
  filters: Record<string, any>;
}

export const useOptimizedTableData = (
  resource: string, 
  initialState: TableState
) => {
  const [state, setState] = useState<TableState>(initialState);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const buildQueryString = useCallback((currentState: TableState) => {
  const params = new URLSearchParams();
  
  params.append('page', currentState.page.toString());
  params.append('limit', currentState.limit.toString());
  
  if (currentState.search) {
    params.append('search', currentState.search);
  }
  
  // Enviar ordenação - usar o formato sort[field]=direction
  if (Object.keys(currentState.sort).length > 0) {
    console.log('🔄 Estado de ordenação atual:', currentState.sort);
    
    Object.entries(currentState.sort).forEach(([key, value]) => {
      if (value && (value === 'asc' || value === 'desc')) {
        // Remover prefixo "sort_" se existir
        const cleanKey = key.replace(/^sort_/, '');
        params.append(`sort[${cleanKey}]`, value);
        console.log(`🔄 Enviando ordenação: sort[${cleanKey}]=${value}`);
      }
    });
  } else {
    // Ordenação padrão
    params.append('sort[created_at]', 'desc');
    console.log('🔄 Enviando ordenação padrão: sort[created_at]=desc');
  }
  
  // Enviar filtros
  if (Object.keys(currentState.filters).length > 0) {
    Object.entries(currentState.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          params.append(key, value.toString());
        }
        else if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v.toString()));
        }
        else if (typeof value === 'object') {
          params.append(key, JSON.stringify(value));
        }
      }
    });
  }
  
  const queryString = params.toString();
  console.log(`🔗 Query string gerada: ${queryString}`);
  return queryString;
}, [resource]);
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const queryString = buildQueryString(state);
      const url = `${process.env.NEXT_PUBLIC_URL_API}/${resource}?${queryString}`;
      
      console.log(`📡 Buscando dados de: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Dados recebidos de ${resource}:`, {
        total: result.count || result.total || 0,
        items: result.data ? result.data.length : result.items ? result.items.length : 0,
        sort: state.sort
      });
      
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error(`❌ Erro ao carregar dados de ${resource}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [state, resource, buildQueryString]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateState = useCallback((updates: Partial<TableState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Aplica uma alteração na linha já carregada, sem esperar o servidor.
   * Usado para dar resposta imediata ao salvar; a revalidação vem em seguida
   * em segundo plano e sobrescreve com o dado oficial.
   */
  const patchRow = useCallback((id: string, patch: Record<string, any>) => {
    setData((prev: any) => {
      if (!prev) return prev;

      const rows = prev.data ?? prev.items;
      if (!Array.isArray(rows)) return prev;

      const patched = rows.map((row: any) => (row?.id === id ? { ...row, ...patch } : row));
      return prev.data ? { ...prev, data: patched } : { ...prev, items: patched };
    });
  }, []);

  return {
    state,
    data,
    isLoading,
    // Só a primeira carga justifica esconder a tela: revalidações posteriores
    // acontecem em segundo plano para não desmontar a busca e os filtros.
    isInitialLoading: isLoading && data === null,
    isRefreshing: isLoading && data !== null,
    error,
    updateState,
    refreshData,
    patchRow
  };
};