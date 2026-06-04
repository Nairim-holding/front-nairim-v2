/**
 * Fetch para Server Components que injeta o token de autenticação
 * lido do cookie via next/headers.
 *
 * O FetchInterceptor (window.fetch) só funciona no cliente — Server
 * Components precisam ler o cookie manualmente. Este helper centraliza isso.
 *
 * O import de next/headers é dinâmico para manter o arquivo seguro caso
 * seja importado por um módulo compartilhado com Client Components.
 */
export async function serverFetch(url: string, options?: RequestInit): Promise<Response> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;

  const headers = new Headers(options?.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}
