import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(), agency: { findFirst: vi.fn() }, supplier: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
vi.mock('@/infra/database/prisma', () => ({ default: { $transaction: (fn: (tx: typeof db) => unknown) => fn(db) } }));
import { PrismaLeaseFinanceRepository } from '../prisma-lease-finance-repository';

const resolve = (new PrismaLeaseFinanceRepository() as unknown as {
  resolveAgencySupplier(agencyId: string, companyId: string): Promise<string | null>;
});
describe('reuse existing financial contact for an agency', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.agency.findFirst.mockResolvedValue({ id: 'agency', cnpj: '12.345.678/0001-90', legal_name: 'Razão social', trade_name: 'Nome fantasia' });
  });
  it('reuses a manually registered contact with the same normalized CNPJ', async () => {
    db.supplier.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'manual', cnpj: '12345678000190' }]);
    expect(await resolve.resolveAgencySupplier('agency', 'company')).toBe('manual');
    expect(db.supplier.update).toHaveBeenCalledWith({ where: { id: 'manual' }, data: { agency_id: 'agency' } });
    expect(db.supplier.create).not.toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalled();
  });
  it('refuses ambiguous matches instead of selecting one or creating a third', async () => {
    db.supplier.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'one', cnpj: '12345678000190' }, { id: 'two', cnpj: '12.345.678/0001-90' },
    ]);
    await expect(resolve.resolveAgencySupplier('agency', 'company')).rejects.toThrow('mais de um contato');
    expect(db.supplier.create).not.toHaveBeenCalled();
    expect(db.supplier.update).not.toHaveBeenCalled();
  });
  it('keeps using a single already linked contact', async () => {
    db.supplier.findMany.mockResolvedValueOnce([{ id: 'existing' }]);
    expect(await resolve.resolveAgencySupplier('agency', 'company')).toBe('existing');
    expect(db.supplier.create).not.toHaveBeenCalled();
  });
});
