import type { AuthUsersRepository } from '@/core/repositories/users-repository';
import type { Hasher } from '@/core/cryptography/hasher';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/** Entrada da troca de senha. */
export interface ChangePasswordInput {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

/**
 * Caso de uso: trocar a senha de um usuário validando a senha atual.
 *
 * Regras (idênticas ao backend):
 *  - usuário inexistente → NotFoundError (404, 'Usuário não encontrado').
 *  - senha atual incorreta → ValidationError (400, 'Senha atual incorreta').
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuthService.ts → `changePassword`.
 */
export class ChangePasswordUseCase {
  constructor(
    private readonly users: AuthUsersRepository,
    private readonly hasher: Hasher,
  ) {}

  async execute({ userId, oldPassword, newPassword }: ChangePasswordInput): Promise<void> {
    const user = await this.users.findCredentialsById(userId);
    if (!user) throw new NotFoundError('Usuário não encontrado');

    const matches = await this.hasher.compare(oldPassword, user.password);
    if (!matches) throw new ValidationError('Senha atual incorreta');

    const hashed = await this.hasher.hash(newPassword);
    await this.users.updatePassword(userId, hashed);
  }
}
