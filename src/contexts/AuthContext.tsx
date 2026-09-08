"use client";

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { getTokenExpiryMs } from '@/utils/jwt';
import { refreshSessionAction, logoutAction } from '@/server/actions/auth';

// ─── Configuração de sessão (segurança) ─────────────────────────────────────
// A credencial (authToken) é gravada como COOKIE DE SESSÃO (sem max-age/expires),
// portanto é apagada ao fechar o navegador → reabrir exige login.
// Além disso, a sessão expira por INATIVIDADE após SESSION_IDLE_TIMEOUT_MS.
// A expiração ABSOLUTA do token é controlada no backend por JWT_EXPIRES_IN.
const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 min sem atividade → exige login
// Renova o token em background antes de expirar, mas apenas se houver atividade recente.
const REFRESH_BEFORE_EXPIRY_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'nairim.lastActivityAt';

/** Marca o instante da última atividade do usuário (para o idle timeout). */
const markActivity = () => {
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* ignore */ }
};
/** Lê a última atividade registrada (0 se ausente). */
const readLastActivity = (): number => {
  try { return Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0); } catch { return 0; }
};
const clearActivity = () => {
  try { localStorage.removeItem(LAST_ACTIVITY_KEY); } catch { /* ignore */ }
};

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
  company_slug?: string;
  created_at?: string | Date;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const navigation = useRouter();

  const logout = useCallback(() => {
    // Limpa a sessão no servidor (Server Action) e no cliente.
    logoutAction().catch(() => {
      console.warn('[AuthContext] Falha ao limpar sessão no servidor.');
    });

    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    sessionStorage.removeItem('userData');
    clearActivity();

    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    navigation.push('/login');
  }, [navigation]);

  const login = (token: string, user: User) => {
    // Cookie de SESSÃO (sem max-age): apagado ao fechar o navegador → reabrir exige login.
    // The login/switch Server Action already set the credential cookie.

    sessionStorage.setItem('userData', JSON.stringify(user));
    markActivity();

    console.log('[AuthContext] Login realizado com sucesso. Token armazenado no cookie de sessão.');

    setAuthState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  useEffect(() => {
    const checkAuth = () => {
      try {
        const cookies = document.cookie.split('; ');
        const authTokenCookie = cookies.find(row => row.startsWith('authToken='));
        let token = null;

        if (authTokenCookie) {
          token = authTokenCookie.split('=')[1];
        }

        if (token) {
          // Segurança: recusa token expirado (não restaura sessão silenciosamente).
          const expiryMs = getTokenExpiryMs(token);
          if (expiryMs !== null && expiryMs <= Date.now()) {
            console.log('[AuthContext] Token expirado. Exigindo novo login.');
            logout();
            return;
          }
          // Segurança: expira por inatividade (mesmo com o navegador reaberto).
          const last = readLastActivity();
          if (last && Date.now() - last > SESSION_IDLE_TIMEOUT_MS) {
            console.log('[AuthContext] Sessão inativa por muito tempo. Exigindo novo login.');
            logout();
            return;
          }

          // Sessão válida: registra atividade (reinicia a janela de inatividade).
          markActivity();

          const userData = sessionStorage.getItem('userData');
          const user = userData ? JSON.parse(userData) : null;

          // O token (cookie) é sempre a fonte da verdade do tenant ativo — o
          // CompanySwitcher grava um token novo com company_id atualizado, mas
          // duas abas da mesma sessão de navegador compartilham o MESMO cookie
          // (path=/) e sessionStorage é por-aba: uma aba que não passou pelo
          // fluxo de troca ainda tem o `userData` da empresa anterior em cache.
          // Sem esta checagem, o app confiava cegamente nesse cache e mostrava
          // dados da empresa errada mesmo com o cookie já correto.
          let payload: any = null;
          try {
            payload = JSON.parse(atob(token.split('.')[1]));
          } catch {
            logout();
            return;
          }

          if (!user || user.company_id !== payload.company_id) {
            const restoredUser = {
              id: payload.id,
              name: payload.name,
              email: payload.email,
              role: payload.role,
              company_id: payload.company_id,
              company_slug: payload.company_slug ?? '',
            };
            sessionStorage.setItem('userData', JSON.stringify(restoredUser));
            setAuthState({ user: restoredUser, token, isAuthenticated: true, isLoading: false });
            console.log('[AuthContext] Sessão restaurada/ressincronizada a partir do token JWT.');
            return;
          }

          setAuthState({
            user,
            token,
            isAuthenticated: !!token,
            isLoading: false,
          });
          console.log('[AuthContext] Usuário já estava autenticado.');
        } else {
          sessionStorage.removeItem('userData');

          setAuthState(prev => ({
            ...prev,
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
          }));
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    checkAuth();

    // Escutar evento de logout forçado (ex: token expirado)
    const handleLogoutEvent = () => {
      console.log('[AuthContext] Evento auth:logout recebido. Deslogando usuário...');
      logout();
    };

    window.addEventListener('auth:logout', handleLogoutEvent);

    return () => {
      window.removeEventListener('auth:logout', handleLogoutEvent);
    };
  }, [logout]);

  // Renova o token em background antes de expirar e reage quando a aba volta a
  // ficar visível (notebook suspenso, aba inativa) para nunca interromper uso ativo.
  useEffect(() => {
    const token = authState.token;
    if (!token) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const performRefresh = async () => {
      // Não renova indefinidamente: se o usuário está inativo além do limite,
      // deixa a sessão expirar (exige novo login) em vez de estendê-la.
      if (Date.now() - readLastActivity() > SESSION_IDLE_TIMEOUT_MS) {
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return;
      }
      try {
        const result = await refreshSessionAction();

        if (!result.ok) {
          throw new Error(result.message || 'Falha ao renovar token');
        }

        if (cancelled) return;

        const newToken = result.token;
        // Mantém cookie de SESSÃO (sem max-age) também na renovação.
        // The refresh Server Action owns cookie flags, including Secure.
        setAuthState(prev => ({ ...prev, token: newToken }));
        console.log('[AuthContext] Token renovado em background.');
      } catch (error) {
        console.warn('[AuthContext] Não foi possível renovar o token em background:', error);
        if (!cancelled) window.dispatchEvent(new CustomEvent('auth:logout'));
      }
    };

    const expiryMs = getTokenExpiryMs(token);
    if (expiryMs !== null) {
      const msUntilRefresh = Math.max(0, expiryMs - Date.now() - REFRESH_BEFORE_EXPIRY_MS);
      timer = setTimeout(performRefresh, msUntilRefresh);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const remainingMs = getTokenExpiryMs(token);
      if (remainingMs !== null && remainingMs - Date.now() <= REFRESH_BEFORE_EXPIRY_MS) {
        performRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authState.token]);

  // Expiração por INATIVIDADE: desloga após SESSION_IDLE_TIMEOUT_MS sem atividade.
  // Também valida ao voltar a visibilidade (aba/janela reaberta após tempo ocioso).
  useEffect(() => {
    if (!authState.token) return;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastReset = 0;

    const forceLogout = () => window.dispatchEvent(new CustomEvent('auth:logout'));

    const armTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(forceLogout, SESSION_IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastReset < 10000) return; // throttle: no máximo a cada 10s
      lastReset = now;
      markActivity();
      armTimer();
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const last = readLastActivity();
      if (last && Date.now() - last > SESSION_IDLE_TIMEOUT_MS) { forceLogout(); return; }
      markActivity();
      armTimer();
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);

    markActivity();
    armTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authState.token]);

  const setLoading = (loading: boolean) => {
    setAuthState(prev => ({
      ...prev,
      isLoading: loading,
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        setLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useUserRole = () => {
  const { user } = useAuth();
  return user?.role || null;
};

export const useIsAuthenticated = () => {
  const { isAuthenticated, isLoading } = useAuth();
  return { isAuthenticated, isLoading };
};
