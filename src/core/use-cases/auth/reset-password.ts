import type { AuthUsersRepository } from '@/core/repositories/users-repository';
import type { TokenSigner } from '@/core/cryptography/token-signer';
import type { Hasher } from '@/core/cryptography/hasher';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/** Payload esperado no token de reset. */
interface ResetTokenPayload {
  id: string;
  email: string;
  type: string;
}

/** Saída da redefinição. */
export interface ResetPasswordOutput {
  success: true;
  message: string;
}

/**
 * Caso de uso: redefinir a senha usando o token de reset.
 *
 * Regras (idênticas ao backend, todas respondendo 400):
 *  - token de tipo diferente de 'password_reset' → 'Token inválido para redefinição de senha'
 *  - token expirado → 'Token de redefinição expirado'
 *  - token inválido → 'Token de redefinição inválido'
 *  - usuário inexistente → 404 'Usuário não encontrado'
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuthService.ts → `resetPassword`.
 */
export class ResetPasswordUseCase {
  constructor(
    private readonly users: AuthUsersRepository,
    private readonly tokenSigner: TokenSigner,
    private readonly hasher: Hasher,
  ) {}

  async execute(token: string, newPassword: string): Promise<ResetPasswordOutput> {
    let decoded: ResetTokenPayload;
    try {
      decoded = this.tokenSigner.verify<ResetTokenPayload>(token);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'TokenExpiredError') throw new ValidationError('Token de redefinição expirado');
      throw new ValidationError('Token de redefinição inválido');
    }

    if (decoded.type !== 'password_reset') {
      throw new ValidationError('Token inválido para redefinição de senha');
    }

    const user = await this.users.findCredentialsById(decoded.id);
    if (!user) throw new NotFoundError('Usuário não encontrado');

    const hashed = await this.hasher.hash(newPassword);
    await this.users.updatePassword(decoded.id, hashed);

    return { success: true, message: 'Senha redefinida com sucesso' };
  }
}
