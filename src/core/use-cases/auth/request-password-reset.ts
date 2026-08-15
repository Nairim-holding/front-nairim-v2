import type { AuthUsersRepository } from '@/core/repositories/users-repository';
import type { TokenSigner } from '@/core/cryptography/token-signer';

/** Saída (mensagem genérica por segurança + token — ver nota). */
export interface RequestPasswordResetOutput {
  success: true;
  message: string;
  /**
   * ⚠️ NOTA DE SEGURANÇA (dívida herdada do backend): o token de reset é
   * devolvido no corpo da resposta porque o envio de e-mail nunca foi
   * implementado. Decisão de migração aprovada: manter como está. Em produção,
   * este token NÃO deveria ser exposto — deve ir por e-mail. Ver
   * CHANGELOG_MIGRATION.md (Módulo Auth).
   */
  resetToken?: string;
}

const GENERIC_MESSAGE =
  'Se o email existir em nosso sistema, você receberá instruções para redefinir sua senha.';

/**
 * Caso de uso: solicitar redefinição de senha.
 *
 * Nunca revela se o e-mail existe (resposta genérica em ambos os casos). Quando
 * existe, gera um token JWT `type: 'password_reset'` válido por 1 hora.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuthService.ts → `requestPasswordReset`.
 */
export class RequestPasswordResetUseCase {
  constructor(
    private readonly users: AuthUsersRepository,
    private readonly tokenSigner: TokenSigner,
  ) {}

  async execute(email: string): Promise<RequestPasswordResetOutput> {
    const user = await this.users.findCredentialsByEmail(email);

    if (!user) {
      // Não revela a inexistência do usuário.
      return { success: true, message: GENERIC_MESSAGE };
    }

    const resetToken = this.tokenSigner.sign(
      { id: user.id, email: user.email, type: 'password_reset' },
      { expiresIn: '1h' },
    );

    return { success: true, message: GENERIC_MESSAGE, resetToken };
  }
}
