'use client';

/**
 * Centraliza todos os Context Providers da aplicação em um único Client Component.
 *
 * O RootLayout (layout.tsx) é um Server Component puro — ele NÃO pode conter
 * diretivas "use client". Ao isolar os providers aqui, mantemos a boundary
 * SSR/CSC limpa: o servidor renderiza o shell HTML e este componente hidrata
 * apenas os providers que precisam de estado do cliente.
 */

import { ReactNode } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { PopupProvider } from '@/contexts/PopupContext';
import { MessageProvider } from '@/contexts/MessageContext';
import { FilterProvider } from '@/contexts/filter-context';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PopupProvider>
          <MessageProvider>
            <FilterProvider>{children}</FilterProvider>
          </MessageProvider>
        </PopupProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
