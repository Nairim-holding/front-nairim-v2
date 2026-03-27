"use client";

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

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

  useEffect(() => {
    const checkAuth = () => {
      try {
        const cookies = document.cookie.split('; ');
        const authTokenCookie = cookies.find(row => row.startsWith('authToken='));
        const token = authTokenCookie ? authTokenCookie.split('=')[1] : null;

        if (token) {
          const userData = localStorage.getItem('userData');
          const user = userData ? JSON.parse(userData) : null;
          
          setAuthState({
            user,
            token,
            isAuthenticated: !!token,
            isLoading: false,
          });
        } else {
          localStorage.removeItem('userData');
          
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
  }, []);

  const login = (token: string, user: User) => {
    document.cookie = `authToken=${token}; path=/`;
    
    localStorage.setItem('userData', JSON.stringify(user));

    setAuthState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  };


  const navigation = useRouter();
  
  const logout = () => {
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    localStorage.removeItem('userData');

    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    navigation.refresh();
  };

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