/**
 * Contrato de hashing de senhas (inversão de dependência).
 *
 * Os casos de uso (core/use-cases) dependem desta interface, nunca de bcrypt
 * diretamente. A implementação concreta vive em infra/auth/bcrypt-hasher.ts.
 *
 * Camada: core.
 * Origem: uso de `bcrypt.hash` / `bcrypt.compare` em
 * api-nairim-v2/src/services/AuthService.ts e UserService.ts.
 */
export interface Hasher {
  /**
   * Gera o hash de uma senha em texto puro.
   * @param plain Senha em texto puro.
   * @returns Hash (formato bcrypt).
   */
  hash(plain: string): Promise<string>;

  /**
   * Compara uma senha em texto puro com um hash.
   * @param plain Senha em texto puro informada pelo usuário.
   * @param hash Hash previamente armazenado.
   * @returns `true` se conferem.
   */
  compare(plain: string, hash: string): Promise<boolean>;
}
