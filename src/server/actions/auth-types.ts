import type { LoginAttemptStatus } from '@/infra/security/login-rate-limiter';
import type { LoginOutput } from '@/core/use-cases/auth/login';

/**
 * Tipos de retorno das Server Actions de autenticação. Ficam separados do
 * arquivo `'use server'` porque este só pode exportar funções async.
 *
 * Camada: server (apresentação SSR).
 */

/** Resultado do login (inclui status de rate limit para a UI). */
export type LoginActionResult =
  | { ok: true; token: string; user: LoginOutput['user']; slug: string }
  | { ok: false; message: string; rateLimit?: LoginAttemptStatus };

/** Resultado do refresh de sessão. */
export type RefreshActionResult =
  | { ok: true; token: string }
  | { ok: false; message: string };
