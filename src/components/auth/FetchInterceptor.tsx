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

/**
 * Intercepta TODOS os fetch() client-side e injeta o Authorization header
 * quando a URL pertence à API do backend (NEXT_PUBLIC_URL_API).
 *
 * Isso evita alterar os 50+ arquivos que usam fetch() diretamente
 * após o middleware global de auth ser adicionado ao backend.
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

      if (url.startsWith(API_BASE)) {
        const token = getAuthTokenFromCookie();
        if (token) {
          const headers = new Headers(init?.headers);
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          return originalFetch(input, { ...init, headers });
        }
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
