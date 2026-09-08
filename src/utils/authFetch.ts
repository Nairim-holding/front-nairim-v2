/**
 * Helper para fazer requisições HTTP autenticadas
 * Automaticamente adiciona o token Authorization ao header
 *
 * Token é obtido de cookies (conforme AuthContext.tsx)
 */

import { isTrustedApiUrl } from './trusted-api-url';

export async function authFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const headers = new Headers(options?.headers || {});

  // Obter token de cookies (onde AuthContext armazena)
  const token = getAuthToken();

  const trusted = typeof window !== 'undefined' &&
    isTrustedApiUrl(url, process.env.NEXT_PUBLIC_URL_API ?? '', window.location.href);
  if (token && trusted) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log('[authFetch] Authorization header adicionado');
  } else {
    console.warn('[authFetch] Token não foi encontrado, requisição será feita sem autenticação');
  }

  // Garantir Content-Type para requisições com body (mas NÃO para FormData)
  if (options?.body && !headers.has('Content-Type')) {
    // Se for FormData, deixa o navegador definir multipart/form-data automaticamente
    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
  }

  console.log('[authFetch] Requisição para:', url);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    console.error('[authFetch] Erro 401 - Não autorizado. Token pode estar expirado ou inválido.');
    // Disparar evento global para deslogar o usuário
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  return response;
}

/**
 * Obter token de autenticação dos cookies
 * Token é armazenado em cookie 'authToken' pelo AuthContext.tsx
 */
function getAuthToken(): string | null {
  if (typeof document === 'undefined') return null;

  try {
    // Buscar no cookie (padrão do projeto)
    const cookies = document.cookie.split('; ');
    const authTokenCookie = cookies.find(row => row.startsWith('authToken='));

    if (authTokenCookie) {
      const token = authTokenCookie.split('=')[1];
      if (token) {
        return token;
      }
    }
  } catch (error) {
    console.error('[authFetch] Erro ao obter token:', error);
  }

  return null;
}
