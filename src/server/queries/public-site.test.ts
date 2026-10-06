import { beforeEach, describe, expect, it, vi } from 'vitest';
const findUnique = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/infra/database/prisma', () => ({ default: { publicSiteSettings: { findUnique } } }));
import { getPublicSiteCompanySlug } from './public-site';

describe('empresa da vitrine', () => {
  beforeEach(() => { vi.unstubAllEnvs(); findUnique.mockReset(); });
  it('usa a empresa selecionada, mesmo apos alterar seu slug', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMPANY_SLUG', 'iholding');
    findUnique.mockResolvedValue({ company: { slug: 'wagner-novo', is_active: true, deleted_at: null } });
    expect(await getPublicSiteCompanySlug()).toBe('wagner-novo');
  });
  it('preserva a configuracao anterior enquanto nao houver selecao', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMPANY_SLUG', 'iholding');
    findUnique.mockResolvedValue(null);
    expect(await getPublicSiteCompanySlug()).toBe('iholding');
  });
  it.each([{ is_active: false, deleted_at: null }, { is_active: true, deleted_at: new Date() }])('nao publica uma empresa desativada ou excluida', async status => {
    findUnique.mockResolvedValue({ company: { slug: 'oculta', ...status } });
    await expect(getPublicSiteCompanySlug()).rejects.toThrow('indisponível');
  });
});
