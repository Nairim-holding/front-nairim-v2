"use client";

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { getTokenExpiryMs, getTokenMaxAgeSeconds } from '@/utils/jwt';

const DEFAULT_TOKEN_MAX_AGE_SECONDS = 12 * 60 * 60;
// Renova o token em background bem antes de expirar, para que uso ativo nunca seja interrompido.
const REFRESH_BEFORE_EXPIRY_MS = 30 * 60 * 1000;

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
  company_slug?: string;
  created_at?: string;
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
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    sessionStorage.removeItem('userData');

    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    navigation.push('/login');
  }, [navigation]);

  const login = (token: string, user: User) => {
    // max-age acompanha o exp real do token (configurado via JWT_EXPIRES_IN no backend)
    const maxAge = getTokenMaxAgeSeconds(token, DEFAULT_TOKEN_MAX_AGE_SECONDS);
    document.cookie = `authToken=${token}; path=/; SameSite=Lax; max-age=${maxAge}`;

    sessionStorage.setItem('userData', JSON.stringify(user));

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
          const userData = sessionStorage.getItem('userData');

          if (!userData) {
            // Cookie existe mas sessionStorage vazio (nova aba, F5, browser reaberto).
            // Decodifica o payload do JWT para restaurar os dados do usuário sem forçar logout.
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
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
              console.log('[AuthContext] Sessão restaurada do token JWT.');
            } catch {
              logout();
            }
            return;
          }

          const user = JSON.parse(userData);

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
      try {
        const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';
        const response = await fetch(`${API_URL}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const result = await response.json();

        if (!response.ok || !result?.data?.token) {
          throw new Error(result?.message || 'Falha ao renovar token');
        }

        if (cancelled) return;

        const newToken = result.data.token as string;
        const maxAge = getTokenMaxAgeSeconds(newToken, DEFAULT_TOKEN_MAX_AGE_SECONDS);
        document.cookie = `authToken=${newToken}; path=/; SameSite=Lax; max-age=${maxAge}`;
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