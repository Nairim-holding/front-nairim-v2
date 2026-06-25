'use client';

import { useEffect } from 'react';

function getAuthTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.split('; ').find(r => r.startsWith('authToken='));
    return match ? match.split('=')[1] : null;
  } catch {
    return null;
  }
}

// Endpoints onde 401 significa "credenciais inválidas"/"sessão sendo renovada",
// não "sessão expirou" — não devem disparar o logout automático.
const AUTH_ENDPOINTS_EXEMPT_FROM_AUTO_LOGOUT = ['/auth/login', '/auth/refresh-token'];

/**
 * Intercepta TODOS os fetch() client-side e injeta o Authorization header
 * quando a URL pertence à API do backend (NEXT_PUBLIC_URL_API).
 *
 * Isso evita alterar os 50+ arquivos que usam fetch() diretamente
 * após o middleware global de auth ser adicionado ao backend.
 *
 * Também observa respostas 401 para deslogar e mostrar "sessão expirada" mesmo
 * nas chamadas que usam fetch() puro (não passam pelo helper authFetch).
 */
export function FetchInterceptor() {
  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_URL_API ?? '';
    if (!API_BASE) return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

      if (!url.startsWith(API_BASE)) {
        return originalFetch(input, init);
      }

      const token = getAuthTokenFromCookie();
      let response: Response;

      if (token) {
        const headers = new Headers(init?.headers);
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        response = await originalFetch(input, { ...init, headers });
      } else {
        response = await originalFetch(input, init);
      }

      const isExempt = AUTH_ENDPOINTS_EXEMPT_FROM_AUTO_LOGOUT.some(path => url.startsWith(`${API_BASE}${path}`));
      if (response.status === 401 && token && !isExempt) {
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
