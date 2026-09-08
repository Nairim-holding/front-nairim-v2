import type { AuthUsersRepository } from '@/core/repositories/users-repository';
import type { CompaniesRepository } from '@/core/repositories/companies-repository';
import type { Hasher } from '@/core/cryptography/hasher';
import type { TokenSigner } from '@/core/cryptography/token-signer';
import type { User, UserCredentials } from '@/core/entities/user';

/**
 * Test doubles (fakes) para os testes dos casos de uso de Auth — sem Prisma,
 * bcrypt ou jwt reais. Camada: testes.
 */

/** Repositório de usuários em memória. */
export class InMemoryUsersRepository implements AuthUsersRepository {
  public items: UserCredentials[] = [];
  public extra: Record<string, Partial<User>> = {};

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.items.find((u) => u.email === email) ?? null;
  }
  async findCredentialsById(id: string): Promise<UserCredentials | null> {
    return this.items.find((u) => u.id === id) ?? null;
  }
  async findById(id: string): Promise<User | null> {
    const u = this.items.find((x) => x.id === id);
    if (!u) return null;
    return {
      id: u.id, name: u.name, email: u.email, role: u.role, company_id: u.company_id,
      birth_date: null, gender: null, created_at: u.created_at, updated_at: u.created_at,
      ...this.extra[id],
    };
  }
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const u = this.items.find((x) => x.id === id);
    if (u) u.password = passwordHash;
  }
}

/** Repositório de empresas em memória (só o necessário ao login). */
export class InMemoryCompaniesRepository implements Pick<CompaniesRepository, 'findSlugById'> {
  public slugs: Record<string, string> = {};
  async findSlugById(id: string): Promise<string | null> {
    return this.slugs[id] ?? null;
  }
}

/** Hasher fake determinístico: hash = `hashed:<plain>`. */
export class FakeHasher implements Hasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

/** Erro que imita os erros do jsonwebtoken (têm `name`). */
class NamedError extends Error {
  constructor(name: string) {
    super(name);
    this.name = name;
  }
}

/**
 * TokenSigner fake: serializa o payload em JSON. Permite marcar tokens como
 * expirados/ inválidos para exercitar os fluxos de erro.
 */
export class FakeTokenSigner implements TokenSigner {
  /** Tokens tratados como expirados no `verify`. */
  public expired = new Set<string>();

  sign(payload: Record<string, unknown>, _options?: { expiresIn?: string }): string {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return 'tok:' + JSON.stringify({ iat: Math.floor(Date.now() / 1000), ...payload, exp });
  }
  verify<T = unknown>(token: string): T {
    if (this.expired.has(token)) throw new NamedError('TokenExpiredError');
    return this.parse<T>(token);
  }
  verifyIgnoringExpiration<T = unknown>(token: string): T {
    return this.parse<T>(token);
  }
  private parse<T>(token: string): T {
    try {
      return JSON.parse(token.replace(/^tok:/, '')) as T;
    } catch {
      throw new NamedError('JsonWebTokenError');
    }
  }
}

/** Cria um usuário de credenciais para os fakes. */
export function makeUser(over: Partial<UserCredentials> = {}): UserCredentials {
  return {
    id: 'user-1',
    name: 'Maria',
    email: 'maria@nairim.com',
    role: 'ADMIN',
    company_id: 'company-1',
    created_at: new Date('2024-01-01T00:00:00Z'),
    password: 'hashed:secret123',
    ...over,
  };
}
