import 'server-only';
import { cookies, headers } from 'next/headers';
import { jwtService } from './jwt-service';
import { runWithTenant } from '@/infra/database/tenant-context';
import type { DecodedSessionToken } from '@/core/cryptography/token-signer';
import { UnauthorizedError, ForbiddenError } from '@/core/errors/domain-errors';
import { prismaUserGroupPermissionsRepository } from '@/infra/repositories/prisma-user-group-permissions-repository';
import type { PermissionAction } from '@/shared/utils/menu-resources';
import { validateLiveSession } from './live-session';
import { assertTenantReferences } from './tenant-references';

/**
 * Sessão do usuário no servidor (SSR) — substitui os middlewares HTTP de
 * autenticação/tenant do Express (`authenticateJWT`, `requireTenant`,
 * `requireAdmin`, `requireSuperAdmin`).
 *
 * Em vez de ler um header `Authorization`, lê o JWT do cookie `authToken` via
 * `next/headers`. É usado por Server Components (leitura) e Server Actions
 * (mutação). `import 'server-only'` garante que nunca vaze para o cliente.
 *
 * ⚠️ Runtime Node (jwt + AsyncLocalStorage). Não usar no Edge.
 * Camada: infra.
 */

/** Nome do cookie de credencial (mesmo do frontend atual). */
export const AUTH_COOKIE = 'authToken';
/** Nome do cookie de slug da empresa (para redirecionos com slug visível). */
export const SLUG_COOKIE = 'company_slug';

/** Papéis considerados administradores (idêntico ao backend). */
const ADMIN_ROLES = ['administrador', 'ADMIN', 'SUPER_ADMIN'];
const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

/**
 * Grava o cookie de sessão (sem max-age = cookie de sessão, apagado ao fechar o
 * navegador — mesmo comportamento do front atual). `httpOnly: false` porque,
 * durante a coexistência, o `authFetch` client-side ainda lê este cookie para
 * chamar os módulos ainda servidos pelo Express.
 */
export async function setSessionCookie(token: string, companySlug?: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, token, { path: '/', sameSite: 'lax', httpOnly: false, secure: process.env.NODE_ENV === 'production' });
  if (companySlug) {
    store.set(SLUG_COOKIE, companySlug, { path: '/', sameSite: 'lax', httpOnly: false });
  }
}

/** Remove o cookie de sessão (logout). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
}

/** Lê o token bruto do cookie, ou `null` se ausente. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value ?? null;
}

/**
 * Retorna a sessão decodificada e válida, ou `null` (token ausente, inválido ou
 * expirado). Não lança — próprio para Server Components decidirem o que renderizar.
 */
export async function getServerSession(): Promise<DecodedSessionToken | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await validateLiveSession(jwtService.verify(token));
  } catch {
    return null;
  }
}

/** Igual a {@link getServerSession}, mas lança UnauthorizedError se não houver sessão. */
export async function requireSession(): Promise<DecodedSessionToken> {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError('Acesso negado. Faça login novamente.');
  return session;
}

/** Exige papel de administrador; lança ForbiddenError caso contrário. */
export function assertAdmin(session: DecodedSessionToken): void {
  if (!ADMIN_ROLES.includes(session.role)) {
    throw new ForbiddenError('Acesso negado. Permissão de administrador necessária.');
  }
}

/** Exige papel de super administrador. */
export function assertSuperAdmin(session: DecodedSessionToken): void {
  if (session.role !== SUPER_ADMIN_ROLE) {
    throw new ForbiddenError('Acesso negado. Permissão de super administrador necessária.');
  }
}

/**
 * Executa `fn` autenticado e DENTRO do contexto de tenant da empresa da sessão
 * (abre o AsyncLocalStorage para o Prisma filtrar por `company_id`).
 * Equivalente a `authenticateJWT + requireTenant` do backend.
 *
 * @param fn recebe a sessão; seu retorno é repassado.
 * @param opts.role papel exigido (ex: ADMIN) — opcional.
 */
export async function withTenant<T>(
  fn: (session: DecodedSessionToken) => Promise<T>,
  opts?: { role?: 'admin' | 'superAdmin' },
): Promise<T> {
  const session = await requireSession();
  if (opts?.role === 'admin') assertAdmin(session);
  if (opts?.role === 'superAdmin') assertSuperAdmin(session);
  if (!session.company_id) {
    throw new ForbiddenError('Contexto de empresa não identificado. Faça login novamente.');
  }
  return runWithTenant(session.company_id, () => fn(session));
}

/**
 * Executa `fn` autenticado, dentro do contexto de tenant, e só se a sessão
 * tiver a permissão `action` no recurso `resource` — equivalente a
 * `authenticateJWT + requireTenant + canView/canCreate/canEdit/canDelete/
 * canExport(resource)` do backend (`middlewares/permission.ts`).
 *
 * Regra de autorização (idêntica ao backend — não são bypasses cosméticos):
 * 1. `role === 'SUPER_ADMIN'` → sempre libera.
 * 2. Administrador sem grupo mantém acesso à própria empresa. Usuários comuns
 *    sem grupo e grupos excluídos/inválidos não recebem permissões implícitas.
 * 3. Senão, exige `perms.get(resource)?.has(action)` → `ForbiddenError` (403)
 *    caso contrário.
 *
 * ⚠️ Papel ADMIN NÃO tem bypass por role — só SUPER_ADMIN. Um ADMIN sem grupo
 * é irrestrito na própria empresa pela regra 2, mas fica restrito assim que é atribuído a um
 * grupo com a matriz configurada. Não é um detalhe cosmético — é a regra de
 * segurança central dos módulos que usam este guard (ex.: user-groups).
 */
export async function withPermission<T>(
  resource: string,
  action: PermissionAction,
  fn: (session: DecodedSessionToken) => Promise<T>,
): Promise<T> {
  return withTenant(async (session) => {
    if (session.role === 'SUPER_ADMIN') return fn(session);
    if (['users', 'user-groups'].includes(resource) && action !== 'view' && action !== 'export') {
      assertAdmin(session);
    }

    const perms = await prismaUserGroupPermissionsRepository.resolveForUser(session.id);
    if (perms === null && ADMIN_ROLES.includes(session.role)) return fn(session);

    if (!perms?.get(resource)?.has(action)) {
      throw new ForbiddenError('Acesso negado. Seu grupo de usuário não tem permissão para esta ação.');
    }
    return fn(session);
  });
}

/** IP do cliente a partir dos headers de proxy (para rate limit de login). */
export async function getRequestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'unknown';
}

/** Authorize first, then validate ownership of all supplied foreign keys. */
export async function withPermissionInput<T>(
  resource: string,
  action: PermissionAction,
  input: object,
  fn: (session: DecodedSessionToken) => Promise<T>,
): Promise<T> {
  return withPermission(resource, action, async (session) => {
    await assertTenantReferences(input as Record<string, unknown>);
    return fn(session);
  });
}
