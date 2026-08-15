import type { TokenSigner, DecodedSessionToken } from '@/core/cryptography/token-signer';
import { UnauthorizedError } from '@/core/errors/domain-errors';

/** Saída do refresh. */
export interface RefreshTokenOutput {
  token: string;
  expiresIn: string;
}

/**
 * Caso de uso: renovar o JWT de sessão.
 *
 * Tolera tokens expirados há pouco tempo (grace period de 5 min): o refresh em
 * background do front pode chegar logo após o `exp` (aba inativa, notebook
 * suspenso). Se passou do grace, exige novo login.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuthService.ts → `refreshToken`.
 */
export class RefreshTokenUseCase {
  private static readonly REFRESH_GRACE_PERIOD_MS = 5 * 60 * 1000;

  constructor(
    private readonly tokenSigner: TokenSigner,
    private readonly sessionTtl: string,
  ) {}

  async execute(oldToken: string): Promise<RefreshTokenOutput> {
    let decoded: DecodedSessionToken;

    try {
      decoded = this.tokenSigner.verify<DecodedSessionToken>(oldToken);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name !== 'TokenExpiredError') {
        // Assinatura inválida (não apenas expirada) → não renova.
        throw new UnauthorizedError('Token expirado, faça login novamente');
      }

      // Expirado: aceita dentro do grace period.
      decoded = this.tokenSigner.verifyIgnoringExpiration<DecodedSessionToken>(oldToken);
      if (Date.now() - decoded.exp * 1000 > RefreshTokenUseCase.REFRESH_GRACE_PERIOD_MS) {
        throw new UnauthorizedError('Token expirado, faça login novamente');
      }
    }

    const token = this.tokenSigner.sign(
      {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
        company_id: decoded.company_id,
      },
      { expiresIn: this.sessionTtl },
    );

    return { token, expiresIn: this.sessionTtl };
  }
}
