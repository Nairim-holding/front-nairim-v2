import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '@/core/errors/domain-errors';

const mocks = vi.hoisted(() => ({ getOrigin: vi.fn(), withPermission: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/infra/auth/session', () => ({ withPermission: mocks.withPermission }));
vi.mock('@/infra/repositories/prisma-property-roi-repository', () => ({
  prismaPropertyRoiRepository: { getOrigin: mocks.getOrigin },
}));

import { getRoiOriginAction } from '@/server/actions/property-roi';

const input = { from: '2025-10-14', to: '2026-10-13', propertyIds: ['p1'], metric: 'roi' };

describe('consulta de origem do ROI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withPermission.mockImplementation(async (_resource: string, _permission: string, callback: (session: { company_id: string }) => unknown) => callback({ company_id: 'company-session' }));
    mocks.getOrigin.mockResolvedValue({ metric: 'roi', value: 0.05 });
  });

  it('exige permissão de visualização e usa empresa da sessão e data de São Paulo', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T01:00:00.000Z'));
    try {
      const result = await getRoiOriginAction({ ...input, company_id: 'company-client', today: '2099-01-01' });
      expect(result).toEqual({ ok: true, data: { metric: 'roi', value: 0.05 } });
      expect(mocks.withPermission).toHaveBeenCalledWith('financial-audit', 'view', expect.any(Function));
      expect(mocks.getOrigin).toHaveBeenCalledWith({ ...input, today: '2026-10-14' }, 'company-session');
    } finally {
      vi.useRealTimers();
    }
  });

  it('não consulta a origem quando a permissão é negada', async () => {
    mocks.withPermission.mockRejectedValue(new ForbiddenError());
    expect(await getRoiOriginAction(input)).toMatchObject({ ok: false, status: 403 });
    expect(mocks.getOrigin).not.toHaveBeenCalled();
  });

  it.each([
    { metric: 'not-a-roi-metric' },
    { from: '2026-02-30' },
    { from: '2026-10-15', to: '2026-10-14' },
    { to: 'invalid-date' },
    { propertyIds: [] },
    { propertyIds: [' '] },
    { propertyIds: 'p1' },
    { propertyIds: undefined },
  ])('recusa entrada inválida sem consultar dados: %j', async (invalid) => {
    expect(await getRoiOriginAction({ ...input, ...invalid })).toMatchObject({ ok: false, status: 400 });
    expect(mocks.getOrigin).not.toHaveBeenCalled();
  });

  it('normaliza e elimina IDs repetidos', async () => {
    await getRoiOriginAction({ ...input, propertyIds: [' p1 ', 'p1', 'p2'] });
    expect(mocks.getOrigin.mock.calls[0][0].propertyIds).toEqual(['p1', 'p2']);
  });

  it('serializa imóvel ausente ou fora do escopo como 404', async () => {
    mocks.getOrigin.mockRejectedValue(new NotFoundError('Imóvel não encontrado.'));
    expect(await getRoiOriginAction(input)).toMatchObject({ ok: false, status: 404, error: 'Imóvel não encontrado.' });
  });
});
