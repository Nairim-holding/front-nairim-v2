import type { DecodedSessionToken } from './token-signer';
import { UnauthorizedError } from '@/core/errors/domain-errors';

/** A valid signature alone does not make a password-reset JWT a session. */
export function assertSessionClaims(value: unknown): asserts value is DecodedSessionToken {
  if (!value || typeof value !== 'object') throw new UnauthorizedError('Sessão inválida');
  const claims = value as Record<string, unknown>;
  if ((claims.type !== undefined && claims.type !== 'session') ||
      !['id', 'name', 'email', 'company_id'].every((key) => typeof claims[key] === 'string' && claims[key] !== '') ||
      !['ADMIN', 'DEFAULT', 'SUPER_ADMIN', 'administrador', 'usuário'].includes(String(claims.role)) ||
      !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp) ||
      Number(claims.exp) <= Number(claims.iat)) {
    throw new UnauthorizedError('Sessão inválida');
  }
}
