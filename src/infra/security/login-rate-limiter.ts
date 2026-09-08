/**
 * Rate limiter de login por conta (independente de IP informado pelo cliente).
 * Baseado no porte de
 * api-nairim-v2/src/middlewares/authRateLimit.ts.
 *
 * ⚠️ LIMITAÇÃO CONHECIDA (mesma do backend): o estado vive em memória do
 * processo. Funciona em deploy Node/Docker de instância única (alvo aprovado).
 * Em múltiplas instâncias o bloqueio seria por-instância — nesse caso, migrar
 * para um store compartilhado (Redis/DB). Documentado no CHANGELOG_MIGRATION.md.
 *
 * Camada: infra.
 */

interface FailedAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  blockedUntil?: number;
}

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutos
const ENTRY_TTL_MS = 60 * 60 * 1000; // remove entradas ociosas após 1h

/** Status detalhado retornado ao front na resposta 401 de credenciais inválidas. */
export interface LoginAttemptStatus {
  failedAttempts: number;
  remainingAttempts: number;
  isBlocked: boolean;
  blockedUntilSeconds: number | null;
  blockDurationMinutes: number;
  shouldWarnAboutBlockage: boolean;
}

class LoginRateLimiter {
  private readonly attempts = new Map<string, FailedAttempt>();

  private key(email: string): string {
    // Client-controlled proxy headers must not reset the account's failure count.
    return email.toLowerCase().trim();
  }

  /** Remove entradas expiradas (limpeza oportunista, sem timers). */
  private sweep(now: number): void {
    for (const [k, a] of this.attempts) {
      if (a.blockedUntil && a.blockedUntil < now) {
        delete a.blockedUntil;
        a.count = 0;
      }
      if (now - a.lastAttempt > ENTRY_TTL_MS) this.attempts.delete(k);
    }
  }

  /**
   * Verifica se o par está bloqueado no momento.
   * @returns mensagem de bloqueio se bloqueado, senão `null`.
   */
  checkBlocked(email: string, _ip: string): string | null {
    const now = Date.now();
    this.sweep(now);
    const a = this.attempts.get(this.key(email));
    if (a?.blockedUntil && a.blockedUntil > now) {
      const remaining = Math.ceil((a.blockedUntil - now) / 1000);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return `Muitas tentativas de login falharam. Tente novamente em ${minutes}m ${seconds}s.`;
    }
    return null;
  }

  /** Registra uma tentativa falha; bloqueia ao atingir o máximo. */
  registerFailure(email: string, _ip: string): void {
    const now = Date.now();
    const k = this.key(email);
    const current = this.attempts.get(k) ?? { count: 0, firstAttempt: now, lastAttempt: now };

    current.count++;
    current.lastAttempt = now;
    if (current.count >= MAX_ATTEMPTS) {
      current.blockedUntil = now + BLOCK_DURATION_MS;
    }
    this.attempts.set(k, current);
  }

  /** Zera o contador após login bem-sucedido. */
  reset(email: string, _ip: string): void {
    this.attempts.delete(this.key(email));
  }

  /** Status atual para compor a resposta de erro (formato do backend). */
  getStatus(email: string, _ip: string): LoginAttemptStatus {
    const now = Date.now();
    const a = this.attempts.get(this.key(email));

    if (!a) {
      return {
        failedAttempts: 0,
        remainingAttempts: MAX_ATTEMPTS,
        isBlocked: false,
        blockedUntilSeconds: null,
        blockDurationMinutes: Math.floor(BLOCK_DURATION_MS / 1000 / 60),
        shouldWarnAboutBlockage: false,
      };
    }

    const isBlocked = !!(a.blockedUntil && a.blockedUntil > now);
    const blockedUntilSeconds = isBlocked ? Math.ceil((a.blockedUntil! - now) / 1000) : null;
    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - a.count);

    return {
      failedAttempts: a.count,
      remainingAttempts,
      isBlocked,
      blockedUntilSeconds,
      blockDurationMinutes: Math.floor(BLOCK_DURATION_MS / 1000 / 60),
      shouldWarnAboutBlockage: !isBlocked && remainingAttempts <= 2 && remainingAttempts > 0,
    };
  }
}

// Singleton persistente ao hot reload do dev.
const globalForLimiter = globalThis as unknown as { loginRateLimiter?: LoginRateLimiter };
export const loginRateLimiter = globalForLimiter.loginRateLimiter ?? new LoginRateLimiter();
if (process.env.NODE_ENV !== 'production') globalForLimiter.loginRateLimiter = loginRateLimiter;
