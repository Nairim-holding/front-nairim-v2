import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  iptuAuditSettings: { findUnique: vi.fn() }, property: { findMany: vi.fn() }, transaction: { findMany: vi.fn() },
}));
vi.mock('@/infra/database/prisma', () => ({ default: db }));
import { PrismaIptuAuditRepository } from '../prisma-iptu-audit-repository';

describe('IPTU audit analytical data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.iptuAuditSettings.findUnique.mockResolvedValue({ income_category_id: 'income', expense_category_id: 'expense' });
    db.property.findMany.mockResolvedValue([
      { id: 'p', title: 'Imóvel de teste', type: { description: 'Casa' }, center_id: 'center', debit_center_id: null, addresses: [] },
    ]);
    db.transaction.findMany.mockImplementation(async ({ where }) => where.category_id === 'income' ? [
      { id: 'refund', description: 'Restituição IPTU', amount: '120', event_date: new Date('2026-02-01Z'), effective_date: new Date('2026-03-02Z'), center_id: null,
        lease: { contract_number: 'TEST-1', property: { id: 'p' }, tenant: { name: 'Inquilino de teste' } } },
    ] : [
      { id: 'paid', description: 'Pagamento IPTU', amount: '100', event_date: new Date('2026-03-01Z'), effective_date: new Date('2026-03-01Z'), center_id: 'center', lease: null },
    ]);
  });
  it('identifies the property type and tenant while keeping manual payments in the same totals', async () => {
    const result = await new PrismaIptuAuditRepository().getAudit({ startDate: '2026-01-01', endDate: '2026-12-31' }, 'company');
    expect(result.rows[0].propertyType).toBe('Casa');
    expect(result.rows[0].transactions).toEqual([
      expect.objectContaining({ id: 'paid', tenantName: null, contractNumber: null, amount: 100 }),
      expect.objectContaining({ id: 'refund', tenantName: 'Inquilino de teste', contractNumber: 'TEST-1', date: '2026-03-02', amount: 120 }),
    ]);
    expect(result.monthly).toEqual([{ key: '2026-03', label: 'Mar/2026', income: 120, expense: 100, balance: 20 }]);
    expect(result.totals).toEqual({ income: 120, expense: 100, balance: 20 });
  });
  it('keeps transaction details within the selected properties', async () => {
    const result = await new PrismaIptuAuditRepository().getAudit({ startDate: '2026-01-01', endDate: '2026-12-31', propertyIds: ['another-property'] }, 'company');
    expect(result.rows).toEqual([]);
    expect(result.monthly).toEqual([]);
    expect(result.totals.income).toBe(0);
  });
});
