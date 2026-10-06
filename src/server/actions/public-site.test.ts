import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), guard: vi.fn(), company: vi.fn(), upsert: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/infra/auth/session', () => ({ requireSession: mocks.session, assertSuperAdmin: mocks.guard }));
vi.mock('@/infra/database/prisma', () => ({ default: { company: { findFirst: mocks.company }, publicSiteSettings: { upsert: mocks.upsert } } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { savePublicSiteSettingsAction } from './public-site';
const id = '00000000-0000-4000-8000-000000000001';
describe('alteracao da vitrine', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ role: 'SUPER_ADMIN' }); });
  it('exige superadministrador antes de acessar empresas ou salvar', async () => {
    mocks.guard.mockImplementation(() => { throw new Error('Acesso negado'); });
    expect((await savePublicSiteSettingsAction(id)).ok).toBe(false);
    expect(mocks.company).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('rejeita uma empresa indisponivel sem alterar a selecao', async () => {
    mocks.company.mockResolvedValue(null);
    expect((await savePublicSiteSettingsAction(id)).ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('salva por ID e invalida a pagina publica', async () => {
    mocks.company.mockResolvedValue({ id });
    expect((await savePublicSiteSettingsAction(id)).ok).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith({ where: { id: 'main' }, create: { id: 'main', company_id: id }, update: { company_id: id } });
    expect(mocks.revalidate).toHaveBeenCalledWith('/', 'layout');
  });
});
