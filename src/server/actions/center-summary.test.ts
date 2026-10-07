import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ groupBy: vi.fn(), centers: vi.fn(), categories: vi.fn(), properties: vi.fn(), permission: vi.fn(), denied: false }));
vi.mock('@/infra/database/prisma', () => ({ default: {
  transaction: { groupBy: state.groupBy }, center: { findMany: state.centers }, category: { findMany: state.categories }, property: { findMany: state.properties },
} }));
vi.mock('@/infra/auth/session', () => ({
  withPermission: async (resource: string, action: string, callback: (session: object) => unknown) => {
    state.permission(resource, action); if (state.denied) throw new Error('Permissão recusada');
    return callback({ role: 'ADMIN', company_id: 'a' });
  },
  assertSuperAdmin: vi.fn(),
}));
import { getCenterSummaryAction } from './center-summary';
beforeEach(() => {
  vi.clearAllMocks(); state.denied = false;
  state.groupBy.mockResolvedValue([{ center_id: 'cr', category_id: 'in', _sum: { amount: '1500.00' } }, { center_id: 'db', category_id: 'out', _sum: { amount: '250.00' } }]);
  state.centers.mockResolvedValue([{ id: 'cr', name: 'Aluguel', company_id: 'a', type: 'INCOME' }, { id: 'db', name: 'Manutenção', company_id: 'a', type: 'EXPENSE' }]);
  state.categories.mockResolvedValue([{ id: 'in', type: 'INCOME' }, { id: 'out', type: 'EXPENSE' }]);
  state.properties.mockResolvedValue([{ id: 'property', title: 'Rua América, 389', company_id: 'a', center_id: 'cr', debit_center_id: 'db' }]);
});
it('returns one property block from separately aggregated credit/debit center IDs', async () => {
  const result = await getCenterSummaryAction({ startDate: '2026-01-01', endDate: '2026-12-31', regime: 'caixa' });
  expect(result).toMatchObject({ ok: true, data: [{ id: 'property:property', name: 'Rua América, 389', income: 1500, expense: 250, balance: 1250 }] });
  expect(state.permission).toHaveBeenCalledWith('financial-transactions', 'view');
  expect(state.properties).toHaveBeenCalledWith({ where: { deleted_at: null, OR: [{ center_id: { in: ['cr', 'db'] } }, { debit_center_id: { in: ['cr', 'db'] } }] }, select: { id: true, title: true, company_id: true, center_id: true, debit_center_id: true } });
  expect(state.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ NOT: { is_transfer: true }, effective_date: expect.any(Object) }) }));
});
it('preserves the competency date field and center filters', async () => {
  expect((await getCenterSummaryAction({ startDate: '2026-01-01', endDate: '2026-12-31', regime: 'competencia', center_id: ['cr', 'db'] })).ok).toBe(true);
  expect(state.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ center_id: { in: ['cr', 'db'] }, event_date: expect.any(Object) }) }));
});
it('does not read property or transaction data when access is denied', async () => {
  state.denied = true;
  expect((await getCenterSummaryAction({ startDate: '2026-01-01', endDate: '2026-12-31' })).ok).toBe(false);
  expect(state.groupBy).not.toHaveBeenCalled(); expect(state.properties).not.toHaveBeenCalled();
});
