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
    console.log('[authFetch] Authorization header adicionado');
  } else {
    console.warn('[authFetch] Token não foi encontrado, requisição será feita sem autenticação');
  }

  // Sempre garantir Content-Type para requisições com body
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
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
        console.log('[authFetch] Token obtido do cookie:', token ? `${token.substring(0, 20)}...` : 'vazio');
        return token;
      }
    }
    console.warn('[authFetch] Cookie authToken não encontrado. Cookies disponíveis:', document.cookie ? document.cookie.substring(0, 100) + '...' : 'nenhum');
  } catch (error) {
    console.error('[authFetch] Erro ao obter token:', error);
  }

  return null;
}
