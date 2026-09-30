import { beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ category: vi.fn(), subcategory: vi.fn(), center: vi.fn() }));
vi.mock('@/server/actions/financial-category', () => ({ quickCreateFinancialCategoryAction: actions.category }));
vi.mock('@/server/actions/financial-subcategory', () => ({ quickCreateFinancialSubcategoryAction: actions.subcategory }));
vi.mock('@/server/actions/financial-center', () => ({ quickCreateFinancialCenterAction: actions.center }));

import { resolvePropertyQuickCreates } from './propertyQuickCreate';

beforeEach(() => {
  vi.resetAllMocks();
  actions.category.mockImplementation(async ({ name }) => ({ ok: true, data: { id: `category-${name}` } }));
  actions.subcategory.mockImplementation(async ({ name }) => ({ ok: true, data: { id: `subcategory-${name}` } }));
  actions.center.mockImplementation(async ({ type }) => ({ ok: true, data: { id: `center-${type}` } }));
});

describe('property financial quick create', () => {
  it('creates the parent category before its subcategory and keeps credit and debit types distinct', async () => {
    const data = {
      category_id: '__new__:Aluguéis', subcategory_id: '__new__:Residenciais',
      center_id: '__new__:Imóveis', debit_center_id: '__new__:Imóveis',
      iptu_refund_category_id: '__new__:Restituições', iptu_refund_subcategory_id: '__new__:IPTU',
    };
    const result = await resolvePropertyQuickCreates(data);
    expect(result).toEqual({
      category_id: 'category-Aluguéis', subcategory_id: 'subcategory-Residenciais',
      center_id: 'center-INCOME', debit_center_id: 'center-EXPENSE',
      iptu_refund_category_id: 'category-Restituições', iptu_refund_subcategory_id: 'subcategory-IPTU',
    });
    expect(actions.category).toHaveBeenNthCalledWith(1, { name: 'Aluguéis', type: 'INCOME' });
    expect(actions.subcategory).toHaveBeenNthCalledWith(1, { name: 'Residenciais', category_id: 'category-Aluguéis' });
    expect(actions.subcategory).toHaveBeenNthCalledWith(2, { name: 'IPTU', category_id: 'category-Restituições' });
    expect(actions.category.mock.invocationCallOrder[0]).toBeLessThan(actions.subcategory.mock.invocationCallOrder[0]);
    expect(actions.center).toHaveBeenNthCalledWith(1, { name: 'Imóveis', type: 'INCOME' });
    expect(actions.center).toHaveBeenNthCalledWith(2, { name: 'Imóveis', type: 'EXPENSE' });
    expect(data.category_id).toBe('__new__:Aluguéis');
  });

  it('keeps existing IDs and empty selections without creating anything', async () => {
    const data = { category_id: 'existing', subcategory_id: '', center_id: null, debit_center_id: '', sale_notes: 'Informações' };
    expect(await resolvePropertyQuickCreates(data)).toEqual(data);
    expect(actions.category).not.toHaveBeenCalled();
    expect(actions.subcategory).not.toHaveBeenCalled();
    expect(actions.center).not.toHaveBeenCalled();
  });

  it('creates a subcategory under an existing category', async () => {
    await resolvePropertyQuickCreates({ category_id: 'existing', subcategory_id: '__new__:Nova' });
    expect(actions.category).not.toHaveBeenCalled();
    expect(actions.subcategory).toHaveBeenCalledWith({ name: 'Nova', category_id: 'existing' });
  });

  it('rejects a new subcategory without its parent', async () => {
    await expect(resolvePropertyQuickCreates({ subcategory_id: '__new__:Nova' })).rejects.toThrow('Selecione uma categoria');
    expect(actions.subcategory).not.toHaveBeenCalled();
  });

  it.each(['category', 'subcategory', 'center'] as const)('stops saving and reports a failed %s creation', async (action) => {
    actions[action].mockResolvedValue({ ok: false, status: 403, error: 'Sem permissão' });
    const data = action === 'category' ? { category_id: '__new__:Nova' }
      : action === 'subcategory' ? { category_id: 'existing', subcategory_id: '__new__:Nova' }
      : { debit_center_id: '__new__:Novo' };
    await expect(resolvePropertyQuickCreates(data)).rejects.toThrow('Sem permissão');
  });
});
