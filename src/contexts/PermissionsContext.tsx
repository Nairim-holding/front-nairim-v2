"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getMyPermissionsAction } from '@/server/actions/permission';

interface PermissionsState {
  /** true = sem restrição (SUPER_ADMIN, ou ADMIN sem grupo atribuído). */
  unrestricted: boolean;
  /** resource key (ver menuResources.ts no backend) → ação → permitido. */
  resources: Record<string, Record<string, boolean>>;
}

interface PermissionsContextType extends PermissionsState {
  /**
   * action default 'view' — cobre o uso mais comum (visibilidade de menu/ícone).
   * `resource` aceita undefined para simplificar quem consome `resourceForHref`/
   * `resourceForPathname` (rota sem recurso mapeado → sempre permitido).
   */
  can: (resource: string | undefined, action?: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();

  // null = ainda não resolvido (logo após login, action em andamento, ou
  // deslogado — nesse caso não importa, nada autenticado renderiza a UI).
  const [resolved, setResolved] = useState<PermissionsState | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    let cancelled = false;

    (async () => {
      try {
        const result = await getMyPermissionsAction();
        if (cancelled) return;
        if (!result.ok) return; // mesma semântica de "!response.ok" — mantém o estado otimista.

        setResolved({
          unrestricted: result.data.unrestricted !== false,
          resources: result.data.resources ?? {},
        });
      } catch (error) {
        console.error('[PermissionsContext] Falha ao carregar permissões:', error);
        // Falha inesperada: mantém o estado otimista em vez de travar a navegação.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token]);

  // Otimista enquanto não resolvido: evita o menu inteiro sumir por uma fração
  // de segundo no caso comum (admin sem grupo, que é irrestrito mesmo). A
  // única janela de "over-exposição" é cosmética — o backend sempre reforça a
  // permissão real em cada requisição.
  const state: PermissionsState = useMemo(
    () => resolved ?? { unrestricted: true, resources: {} },
    [resolved]
  );

  const can = useCallback(
    (resource: string | undefined, action: string = 'view') => {
      if (!resource || state.unrestricted) return true;
      return state.resources[resource]?.[action] === true;
    },
    [state]
  );

  return (
    <PermissionsContext.Provider value={{ ...state, can }}>
      {children}
    </PermissionsContext.Provider>
  );
}
