import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), properties: vi.fn(), create: vi.fn(), remove: vi.fn(), permission: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: {
  holiday: { findMany: mocks.list, create: mocks.create, updateMany: mocks.remove },
  property: { findMany: mocks.properties },
} }));
vi.mock('@/infra/auth/session', () => ({ withPermission: mocks.permission }));
import { createHolidayAction, deleteHolidayAction, listHolidaysAction } from './holiday';

describe('cadastro e listagem de feriados', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.permission.mockImplementation(async (_resource, _action, callback) => callback({ company_id: 'company' }));
    mocks.list.mockResolvedValue([]);
    mocks.properties.mockResolvedValue([{ addresses: [{ address: { city: 'Garça', state: 'SP' } }, { address: { city: 'Garça', state: 'SP' } }] }]);
  });
  it('preenche o ano automaticamente sem duplicar feriados nem gravar no banco', async () => {
    const result = await listHolidaysAction({ year: 2026 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(13);
    expect(result.data.every((holiday) => holiday.automatic)).toBe(true);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.list.mock.calls[0][0].where.company_id).toBe('company');
    expect(mocks.properties.mock.calls[0][0].where).toEqual({ company_id: 'company', deleted_at: null });
  });
  it('salva a UF de um feriado estadual e ignora cidade nesse escopo', async () => {
    mocks.create.mockImplementation(async ({ data }) => ({ ...data, id: 'holiday' }));
    const result = await createHolidayAction({ date: '2026-08-11', description: 'Feriado estadual', scope: 'STATE', state: 'MG', city: 'Cidade' });
    expect(result.ok).toBe(true);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ company_id: 'company', state: 'MG', city: null, scope: 'STATE', date: new Date('2026-08-11T00:00:00Z') });
    expect(mocks.permission).toHaveBeenCalledWith('financial-transactions', 'edit', expect.any(Function));
  });
  it('rejeita ano e datas inválidos antes de consultar ou gravar', async () => {
    expect((await listHolidaysAction({ year: 1999 })).ok).toBe(false);
    expect((await createHolidayAction({ date: '2026-02-31', description: 'Inválido', scope: 'NATIONAL' })).ok).toBe(false);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('não permite excluir feriado de outra empresa', async () => {
    mocks.remove.mockResolvedValue({ count: 0 });
    expect((await deleteHolidayAction('other-company-holiday')).ok).toBe(false);
    expect(mocks.remove.mock.calls[0][0].where).toEqual({ id: 'other-company-holiday', company_id: 'company', deleted_at: null });
  });
});
