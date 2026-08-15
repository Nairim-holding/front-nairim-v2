import type { AuthUsersRepository } from '@/core/repositories/users-repository';
import type { TokenSigner, DecodedSessionToken } from '@/core/cryptography/token-signer';
import { UnauthorizedError, NotFoundError } from '@/core/errors/domain-errors';
import type { User } from '@/core/entities/user';

/** Perfil retornado por `/auth/me` (sem company_id/senha, como no backend). */
export type CurrentUser = Pick<
  User,
  'id' | 'name' | 'email' | 'birth_date' | 'gender' | 'role' | 'created_at' | 'updated_at'
>;

/**
 * Caso de uso: obter o usuário atual a partir do token.
 *
 * Verifica o token, busca o usuário atualizado no banco (ignorando excluídos) e
 * retorna um subconjunto de campos do perfil.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuthService.ts → `getCurrentUser`.
 */
export class GetCurrentUserUseCase {
  constructor(
    private readonly users: AuthUsersRepository,
    private readonly tokenSigner: TokenSigner,
  ) {}

  async execute(token: string): Promise<CurrentUser> {
    let decoded: DecodedSessionToken;
    try {
      decoded = this.tokenSigner.verify<DecodedSessionToken>(token);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'TokenExpiredError') throw new UnauthorizedError('Token expirado');
      throw new UnauthorizedError('Token inválido');
    }

    const user = await this.users.findById(decoded.id);
    if (!user) throw new NotFoundError('Usuário não encontrado');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      birth_date: user.birth_date,
      gender: user.gender,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
