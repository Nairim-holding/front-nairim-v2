import { expect, it, vi } from 'vitest';
it('compartilha o mesmo contexto mesmo com módulos reavaliados em produção', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  try {
    const first = await import('../database/tenant-context');
    vi.resetModules();
    const second = await import('../database/tenant-context');
    expect(second.tenantStorage).toBe(first.tenantStorage);
    await first.runWithTenant('particular', async () => {
      expect(second.getCurrentCompanyId()).toBe('particular');
      expect(second.tenantStorage.exit(() => first.getCurrentCompanyId())).toBeUndefined();
      expect(first.getCurrentCompanyId()).toBe('particular');
    });
  } finally { vi.unstubAllEnvs(); }
});
