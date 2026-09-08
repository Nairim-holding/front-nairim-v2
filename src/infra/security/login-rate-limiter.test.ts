import { describe, expect, it } from 'vitest';
import { loginRateLimiter } from './login-rate-limiter';

describe('account login throttling', () => {
  it('does not reset the failed-attempt count when the forwarded IP changes', () => {
    const email = 'rate-limit-security@example.test';
    loginRateLimiter.reset(email, 'initial');
    for (let i = 0; i < 5; i++) loginRateLimiter.registerFailure(email, `forged-${i}`);
    expect(loginRateLimiter.checkBlocked(email, 'another-forged-ip')).not.toBeNull();
    expect(loginRateLimiter.getStatus(email.toUpperCase(), 'new-ip').isBlocked).toBe(true);
    loginRateLimiter.reset(email, 'any-ip');
    expect(loginRateLimiter.checkBlocked(email, 'new-ip')).toBeNull();
  });
});
