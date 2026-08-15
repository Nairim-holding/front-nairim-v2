import type { TokenSigner } from '@/core/cryptography/token-signer';
import { UnauthorizedError } from '@/core/errors/domain-errors';

/** Saída da verificação de token (formato do backend). */
export interface VerifyTokenOutput {
  valid: true;
  decoded: unknown;
  message: string;
}

/**
 * Caso de uso: verificar validade de um JWT.
 *
 * Traduz os erros crus do verificador para erro de domínio:
 *  - expirado → UnauthorizedError('Token expirado')
 *  - inválido → UnauthorizedError('Token inválido')
 * (o backend responde 401 em ambos.)
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuthService.ts → `verifyToken`.
 */
export class VerifyTokenUseCase {
  constructor(private readonly tokenSigner: TokenSigner) {}

  async execute(token: string): Promise<VerifyTokenOutput> {
    try {
      const decoded = this.tokenSigner.verify(token);
      return { valid: true, decoded, message: 'Token válido' };
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'TokenExpiredError') throw new UnauthorizedError('Token expirado');
      throw new UnauthorizedError('Token inválido');
    }
  }
}
