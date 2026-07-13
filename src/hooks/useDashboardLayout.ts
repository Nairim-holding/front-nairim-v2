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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await authFetch(`${API_URL}/user-preferences/dashboard-layout?resource=${resource}`);
        if (response.ok) {
          const result = await response.json();
          if (!cancelled && Array.isArray(result.data?.layout) && result.data.layout.length > 0) {
            setLayout(result.data.layout);
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
