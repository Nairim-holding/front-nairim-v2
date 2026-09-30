import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({
  default: { supplier: { findMany: mocks.findMany, count: mocks.count } },
}));

import { PrismaFinancialSuppliersRepository } from '../prisma-financial-suppliers-repository';

describe('busca completa de contatos financeiros', () => {
  it('acha por celular além dos primeiros 100 contatos', async () => {
    mocks.findMany.mockResolvedValue([
      ...Array.from({ length: 100 }, (_, index) => ({
        id: `other-${index}`, legal_name: `Outro ${index}`, created_at: new Date('2026-01-01'), contacts: [],
      })),
      {
        id: 'wanted', legal_name: 'Contato esperado', created_at: new Date('2026-01-01'),
        contacts: [{ cellphone: '14991663055', channels: [] }],
      },
    ]);

    const result = await new PrismaFinancialSuppliersRepository().list({
      limit: 100, page: 1, search: '99166-3055', filters: {}, sortOptions: {}, includeInactive: false,
    });
    expect(result.data.map((supplier) => supplier.id)).toEqual(['wanted']);
    expect(result.count).toBe(1);
    expect(mocks.findMany.mock.calls[0][0]).not.toHaveProperty('take');
    expect(mocks.count).not.toHaveBeenCalled();
  });
});
