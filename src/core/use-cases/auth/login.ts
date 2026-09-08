import type { AuthUsersRepository } from '@/core/repositories/users-repository';
import type { CompaniesRepository } from '@/core/repositories/companies-repository';
import type { Hasher } from '@/core/cryptography/hasher';
import type { TokenSigner } from '@/core/cryptography/token-signer';
import { InvalidCredentialsError } from '@/core/errors/domain-errors';

/** Entrada do login. */
export interface LoginInput {
  email: string;
  password: string;
}

/** Saída do login — formato consumido pelo frontend (mantido do backend). */
export interface LoginOutput {
  user: {
    id: string;
    name: string;
    email: string;
    /** Papel BRUTO do banco (não mapeado) — igual ao backend original. */
    role: string;
    company_id: string;
    created_at: Date;
    company_slug: string;
  };
  token: string;
  expiresIn: string;
}

/**
 * Caso de uso: autenticação por e-mail/senha.
 *
 * Regras (idênticas ao backend):
 *  - usuário não encontrado ou senha incorreta → InvalidCredentialsError (401,
 *    'Credenciais inválidas'), sem revelar qual dos dois falhou.
 *  - o papel do TOKEN é mapeado ('ADMIN'→'administrador', 'DEFAULT'→'usuário');
 *    o papel do OBJETO `user` retornado permanece o bruto do banco.
 *  - inclui `company_slug` para o front redirecionar ao dashboard da empresa.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuthService.ts → `login`.
 */
export class LoginUseCase {
  /** Mapa de papéis aplicado APENAS ao payload do token (como no backend). */
  private static readonly ROLE_MAP: Record<string, string> = {
    ADMIN: 'administrador',
    DEFAULT: 'usuário',
  };

  constructor(
    private readonly users: AuthUsersRepository,
    // Segregação de interface: o login só precisa resolver o slug da empresa.
    private readonly companies: Pick<CompaniesRepository, 'findSlugById'>,
    private readonly hasher: Hasher,
    private readonly tokenSigner: TokenSigner,
    /** TTL do token de sessão, retornado como `expiresIn` (ex: '12h'). */
    private readonly sessionTtl: string,
  ) {}

  async execute({ email, password }: LoginInput): Promise<LoginOutput> {
    const user = await this.users.findCredentialsByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatch = await this.hasher.compare(password, user.password);
    if (!passwordMatch) {
      throw new InvalidCredentialsError();
    }

    const token = this.tokenSigner.sign(
      {
        type: 'session',
        id: user.id,
        name: user.name,
        email: user.email,
        role: LoginUseCase.ROLE_MAP[user.role] ?? user.role,
        company_id: user.company_id,
      },
      { expiresIn: this.sessionTtl },
    );

    const company_slug = (await this.companies.findSlugById(user.company_id)) ?? '';

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        created_at: user.created_at,
        company_slug,
      },
      token,
      expiresIn: this.sessionTtl,
    };
  }
}
