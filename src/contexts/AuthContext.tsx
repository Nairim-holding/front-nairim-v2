"use client";

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
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
    navigation.refresh();
  }, [navigation]);

  const login = (token: string, user: User) => {
    // Ao remover max-age, o cookie torna-se de sessão (deletado ao fechar o navegador)
    document.cookie = `authToken=${token}; path=/; SameSite=Lax`;

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
            // Cenário: O cookie existe (browser aberto) mas a aba é nova (sessionStorage vazio)
            // Para forçar o login ao fechar a aba, deslogamos se os dados do usuário sumirem
            console.log('[AuthContext] Token encontrado mas dados da sessão sumiram. Forçando logout...');
            logout();
            return;
          }

          const user = JSON.parse(userData);

          setAuthState({
            user,
            token,
            isAuthenticated: !!token,
            isLoading: false,
          });
          console.log('[AuthContext] Usuário já estava autenticado');
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