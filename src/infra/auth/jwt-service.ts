import jwt from 'jsonwebtoken';
import { env } from '@/infra/config/env';
import type { TokenSigner } from '@/core/cryptography/token-signer';

/**
 * Implementação de {@link TokenSigner} com `jsonwebtoken`.
 *
 * Assina/verifica JWTs com `JWT_SECRET` e expiração padrão `JWT_EXPIRES_IN`.
 * Lança os erros crus do jsonwebtoken (`TokenExpiredError`,
 * `JsonWebTokenError`) — a tradução para erro de domínio é responsabilidade de
 * quem chama (use-cases / wrappers HTTP).
 *
 * Camada: infra.
 * Origem: `jwt.sign` / `jwt.verify` em
 * api-nairim-v2/src/services/AuthService.ts e src/middlewares/auth.ts.
 */
export class JwtService implements TokenSigner {
  /** @inheritdoc */
  sign(payload: Record<string, unknown>, options?: { expiresIn?: string }): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: (options?.expiresIn ?? env.JWT_EXPIRES_IN) as jwt.SignOptions['expiresIn'],
    });
  }

  /** @inheritdoc */
  verify<T = unknown>(token: string): T {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as T;
  }

  /** @inheritdoc */
  verifyIgnoringExpiration<T = unknown>(token: string): T {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], ignoreExpiration: true }) as T;
  }
}

/** Instância compartilhada (stateless). */
export const jwtService = new JwtService();
