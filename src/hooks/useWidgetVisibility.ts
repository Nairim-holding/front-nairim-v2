'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getColumnPreferencesAction, saveColumnPreferencesAction } from '@/server/actions/user-preferences';

/**
 * Personalizar quais gráficos aparecem em cada Ambiente (Tarefa 10, 29/07/26).
 * Reaproveita o MESMO endpoint/tabela de preferências de "Personalizar Colunas"
 * (`/user-preferences/column-order`, `UserColumnPreference.visible_columns`) —
 * o formato (lista de ids visíveis, por `resource`, por usuário) já é
 * exatamente o que "quais widgets aparecem" precisa, sem exigir uma tabela
 * nova. `resource` fica prefixado para não colidir com preferências de coluna
 * de outras telas (ex.: `financial-transaction`).
 */
export function useWidgetVisibility(tabResource: string, allWidgetIds: string[]) {
  const resource = `dashboard-widgets-${tabResource}`;
  const [visibleWidgetIds, setVisibleWidgetIdsState] = useState<string[] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allIdsKey = allWidgetIds.join(',');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getColumnPreferencesAction(resource);
        // `[]` é o default de "nenhuma preferência salva" (mesmo sentinel usado
        // para colunas de tabela) — aqui significa "mostrar tudo", não "usuário
        // escondeu todos os widgets". Só respeita uma seleção não-vazia.
        const savedIds = result.ok ? result.data?.visibleColumns : null;
        const saved = Array.isArray(savedIds) && savedIds.length > 0 ? savedIds : null;
        if (!cancelled) setVisibleWidgetIdsState(saved ?? allWidgetIds);
      } catch (error) {
        console.error('[useWidgetVisibility] Erro ao carregar preferência de gráficos:', error);
        if (!cancelled) setVisibleWidgetIdsState(allWidgetIds);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, allIdsKey]);

  const setVisibleWidgetIds = useCallback((ids: string[]) => {
    setVisibleWidgetIdsState(ids);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveColumnPreferencesAction({
        resource,
        columnOrder: [],
        columnWidths: {},
        visibleColumns: ids,
      }).catch((error) => console.error('[useWidgetVisibility] Erro ao salvar preferência de gráficos:', error));
    }, 500);
  }, [resource]);

  return {
    // Enquanto carrega, mostra todos — evita um "pisca vazio" no primeiro render.
    visibleWidgetIds: visibleWidgetIds ?? allWidgetIds,
    isLoaded: visibleWidgetIds !== null,
    setVisibleWidgetIds,
  };
}
