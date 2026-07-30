'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Abaixo disso, o grid arrastável de 12 colunas fica ilegível (colunas viram
 * tiras estreitas) — os grids trocam para uma lista empilhada de largura total,
 * sem drag/resize (que não faz sentido em touch de qualquer forma). */
export const MOBILE_BREAKPOINT_PX = 768;

/**
 * Assina o matchMedia via useSyncExternalStore em vez de useEffect + setState:
 * matchMedia é uma fonte externa, e ler dela dentro de um efeito causa render
 * em cascata (é o que a regra react-hooks/set-state-in-effect aponta).
 *
 * No servidor devolve `false` (desktop) — o mesmo estado inicial de antes.
 */
export function useIsMobile(breakpointPx: number = MOBILE_BREAKPOINT_PX): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [breakpointPx]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(`(max-width: ${breakpointPx}px)`).matches,
    [breakpointPx]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
