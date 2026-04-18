/**
 * Helper para fazer requisições HTTP autenticadas
 * Automaticamente adiciona o token Authorization ao header
 *
 * Token é obtido de cookies (conforme AuthContext.tsx)
 */

export async function authFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const headers = new Headers(options?.headers || {});

  // Obter token de cookies (onde AuthContext armazena)
  const token = getAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Sempre garantir Content-Type para requisições com body
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
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
        return decodeURIComponent(token);
      }
    }
  } catch (error) {
    console.error('[authFetch] Erro ao obter token:', error);
  }

  return null;
}
