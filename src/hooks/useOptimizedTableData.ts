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
  initialState: TableState,
  fetcher?: (state: TableState) => Promise<any>
) => {
  const [state, setState] = useState<TableState>(initialState);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!fetcher) {
        throw new Error(`useOptimizedTableData: fetcher ausente para ${resource} — dados requerem Server Action`);
      }
      const result = await fetcher(state);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error(`❌ Erro ao carregar dados de ${resource}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [state, resource, fetcher]);

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