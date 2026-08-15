/**
 * Contrato de assinatura/verificação de tokens (JWT) — inversão de dependência.
 *
 * Os casos de uso dependem desta interface; a implementação concreta com
 * `jsonwebtoken` vive em infra/auth/jwt-service.ts.
 *
 * Camada: core.
 * Origem: `jwt.sign` / `jwt.verify` em api-nairim-v2/src/services/AuthService.ts
 * e src/middlewares/auth.ts.
 */

/** Conteúdo do JWT de sessão emitido no login (payload do backend original). */
export interface SessionTokenPayload {
  /** ID do usuário. */
  id: string;
  /** Nome do usuário. */
  name: string;
  /** E-mail do usuário. */
  email: string;
  /** Papel/role já mapeado (ex: 'administrador', 'SUPER_ADMIN', 'usuário'). */
  role: string;
  /** Empresa (tenant) do usuário — base do multi-tenant. */
  company_id: string;
}

/** Payload decodificado (inclui os claims padrão de tempo do JWT). */
export type DecodedSessionToken = SessionTokenPayload & {
  /** Emitido em (epoch segundos). */
  iat: number;
  /** Expira em (epoch segundos). */
  exp: number;
};

export interface TokenSigner {
  /**
   * Assina um payload e retorna o token.
   * @param payload Dados a incluir no token.
   * @param options Sobrescreve a expiração padrão (ex: '1h' para reset).
   */
  sign(payload: Record<string, unknown>, options?: { expiresIn?: string }): string;

  /**
   * Verifica assinatura e expiração, retornando o payload decodificado.
   * @throws Erro cru do jsonwebtoken (TokenExpiredError / JsonWebTokenError);
   *         o chamador decide como traduzir para erro de domínio.
   */
  verify<T = DecodedSessionToken>(token: string): T;

  /**
   * Verifica a assinatura ignorando a expiração (usado no refresh com grace
   * period). @throws se a assinatura for inválida.
   */
  verifyIgnoringExpiration<T = DecodedSessionToken>(token: string): T;
}
