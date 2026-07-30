'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/utils/authFetch';
import { useMessageContext } from '@/contexts';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

export interface DashboardLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useDashboardLayout(resource: string, defaultLayout: DashboardLayoutItem[]) {
  const [layout, setLayout] = useState<DashboardLayoutItem[]>(defaultLayout);
  const [isLoading, setIsLoading] = useState(true);
  const { showMessage } = useMessageContext();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Em ref para o efeito depender só de `resource`: o array default costuma ser
  // uma constante de módulo, mas na dependência do efeito qualquer recriação
  // dispararia um refetch desnecessário.
  const defaultLayoutRef = useRef(defaultLayout);
  defaultLayoutRef.current = defaultLayout;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await authFetch(`${API_URL}/user-preferences/dashboard-layout?resource=${resource}`);
        if (response.ok) {
          const result = await response.json();
          const saved = result.data?.layout;
          if (!cancelled) {
            // Sem layout salvo, volta ao default. Antes o state anterior era
            // mantido: ao trocar de `resource` (o bump de versão que aplica um
            // novo arranjo padrão), o grid continuava exibindo o layout do
            // resource antigo, e a nova versão parecia não ter efeito.
            setLayout(Array.isArray(saved) && saved.length > 0 ? saved : defaultLayoutRef.current);
          }
        }
      } catch (error) {
        console.error('[useDashboardLayout] Erro ao carregar layout:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resource]);

  const saveLayout = useCallback((newLayout: DashboardLayoutItem[]) => {
    setLayout(newLayout);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      const MAX_RETRIES = 3;
      let attempt = 0;

      const attemptSave = async (): Promise<void> => {
        try {
          const response = await authFetch(`${API_URL}/user-preferences/dashboard-layout`, {
            method: 'POST',
            body: JSON.stringify({ resource, layout: newLayout }),
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (error) {
          attempt++;
          if (attempt < MAX_RETRIES) {
            const delayMs = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return attemptSave();
          }
          console.error('[useDashboardLayout] Falha ao salvar layout após 3 tentativas:', error);
          showMessage('Erro ao salvar o layout do painel. Tente novamente.', 'error', 5000);
        }
      };

      await attemptSave();
    }, 500);
  }, [resource, showMessage]);

  return { layout, isLoading, saveLayout };
}
