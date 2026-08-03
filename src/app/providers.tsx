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
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { PopupProvider } from '@/contexts/PopupContext';
import { MessageProvider } from '@/contexts/MessageContext';
import { FilterProvider } from '@/contexts/filter-context';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { FetchInterceptor } from '@/components/auth/FetchInterceptor';
import type { CompanyBranding } from '@/types/branding';

export function AppProviders({
  children,
  initialBranding,
}: {
  children: ReactNode;
  initialBranding?: CompanyBranding | null;
}) {
  return (
    <BrandingProvider initialBranding={initialBranding}>
      <FetchInterceptor />
      <ThemeProvider>
        <AuthProvider>
          <PermissionsProvider>
            <PopupProvider>
              <MessageProvider>
                <FilterProvider>{children}</FilterProvider>
              </MessageProvider>
            </PopupProvider>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrandingProvider>
  );
}
