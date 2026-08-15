import bcrypt from 'bcryptjs';
import type { Hasher } from '@/core/cryptography/hasher';

/**
 * Implementação de {@link Hasher} usando bcrypt.
 *
 * NOTA DE MIGRAÇÃO: o backend usava o pacote nativo `bcrypt`. Aqui usamos
 * `bcryptjs` (JS puro) para evitar compilação nativa no Windows/Docker. O
 * formato de hash é o MESMO (bcrypt), então as senhas já cadastradas continuam
 * validando normalmente. Fator de custo mantido em 10 (igual ao backend).
 *
 * Camada: infra.
 * Origem: `bcrypt.hash(..., 10)` / `bcrypt.compare(...)` em
 * api-nairim-v2/src/services/AuthService.ts.
 */
export class BcryptHasher implements Hasher {
  private readonly saltRounds = 10;

  /** @inheritdoc */
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  /** @inheritdoc */
  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

/** Instância compartilhada (stateless). */
export const bcryptHasher = new BcryptHasher();
