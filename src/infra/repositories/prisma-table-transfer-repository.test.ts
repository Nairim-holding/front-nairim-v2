import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ delegates: new Map<string, Record<string, ReturnType<typeof vi.fn>>>(), transaction: vi.fn() }));
vi.mock('@/infra/database/prisma', () => {
  const client = new Proxy({}, { get(_target, key) {
    if (key === '$transaction') return state.transaction;
    if (!state.delegates.has(String(key))) state.delegates.set(String(key), Object.fromEntries(['findMany', 'findFirst', 'create', 'update'].map(method => [method, vi.fn().mockResolvedValue(method === 'findMany' ? [] : method === 'findFirst' ? { id: 'owned' } : {})])));
    return state.delegates.get(String(key));
  } });
  state.transaction.mockImplementation((callback: (tx: object) => unknown) => callback(client));
  return { default: client };
});
import prisma from '@/infra/database/prisma';
import { PrismaTableTransferRepository, tableTransferCopyId } from './prisma-table-transfer-repository';
import { getTransferTable, TRANSFER_TABLES } from '@/shared/data/table-transfer';
import type { TableTransferPayload, TransferRows } from '@/shared/validators/table-transfer';
const repo = new PrismaTableTransferRepository();
const payload = (data: TransferRows) => ({ data } as TableTransferPayload);

describe('Transferência de cadastros entre ambientes', () => {
  beforeEach(() => { state.delegates.clear(); state.transaction.mockClear(); });
  it('exporta todos os registros sem paginação ou filtros da tela e mantém valores decimais como texto', async () => {
    vi.mocked(prisma.repair.findMany).mockResolvedValue([{ id: 'r', company_id: 'a', service_amount: '1500.10' }] as never);
    vi.mocked(prisma.repairItem.findMany).mockResolvedValue([{ id: 'item', repair_id: 'r', amount: '1500.10' }] as never);
    const result = await repo.export(getTransferTable('repairs')!, 'a');
    expect(result.data.Repair[0].service_amount).toBe('1500.10');
    expect(prisma.repair.findMany).toHaveBeenCalledWith({ where: { company_id: 'a' }, orderBy: { id: 'asc' } });
    expect(prisma.repairItem.findMany).toHaveBeenCalledWith({ where: { company_id: 'a', repair_id: { in: ['r'] } }, orderBy: { id: 'asc' } });
    expect(result.meta.counts).toMatchObject({ Repair: 1, RepairItem: 1 });
  });
  it('exporta endereços e canais somente dos contatos selecionados', async () => {
    vi.mocked(prisma.supplier.findMany).mockResolvedValue([{ id: 's' }] as never);
    vi.mocked(prisma.supplierAddress.findMany).mockResolvedValue([{ id: 'link', address_id: 'address', supplier_id: 's' }] as never);
    vi.mocked(prisma.contact.findMany).mockResolvedValue([{ id: 'contact', supplier_id: 's' }] as never);
    await repo.export(getTransferTable('suppliers')!, 'a');
    expect(prisma.address.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ['address'] }, OR: expect.any(Array) }) }));
    expect(prisma.contactChannel.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ contact_id: { in: ['contact'] } }) }));
  });
  it('todos os cadastros podem resolver o escopo e os filtros de suas tabelas filhas', async () => {
    for (const table of TRANSFER_TABLES) {
      const result = await repo.export(table, 'a');
      expect(Object.keys(result.data).sort()).toEqual([table.model, ...table.children].sort());
    }
  });
  it('remapeia a empresa, cria pais antes de filhos e atualiza IDs existentes sem excluir outros', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([{ id: 'c', company_id: 'destination' }] as never);
    const result = await repo.import(getTransferTable('categories')!, payload({ Category: [{ id: 'c', company_id: 'source', name: 'Reforma', type: 'EXPENSE' }], Subcategory: [{ id: 'sc', company_id: 'source', category_id: 'c', name: 'Materiais' }] }), 'destination', 'actor', false);
    expect(result).toEqual({ created: 1, updated: 1 });
    expect(prisma.category.update).toHaveBeenCalledWith({ where: { id: 'c', company_id: 'destination' }, data: { company_id: 'destination', name: 'Reforma', type: 'EXPENSE' } });
    expect(prisma.subcategory.create).toHaveBeenCalledWith({ data: { id: 'sc', company_id: 'destination', category_id: 'c', name: 'Materiais' } });
    expect(vi.mocked(prisma.category.update).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(prisma.subcategory.create).mock.invocationCallOrder[0]);
    expect(state.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });
  it('recusa referências a outra empresa ou ausentes antes de qualquer gravação', async () => {
    vi.mocked(prisma.supplier.findFirst).mockResolvedValue(null);
    const input = payload({ Repair: [{ id: 'r', company_id: 'source', property_id: 'property', supplier_id: 'foreign' }] });
    await expect(repo.import(getTransferTable('repairs')!, input, 'destination', 'actor', false)).rejects.toThrow('importe primeiro');
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', company_id: 'destination' } });
    expect(prisma.repair.create).not.toHaveBeenCalled();
  });
  it('recusa filhos fora da tabela principal e IDs de filhos já ligados a outro registro', async () => {
    const unrelated = payload({ Category: [{ id: 'c' }], Subcategory: [{ id: 'sc', category_id: 'other' }] });
    await expect(repo.import(getTransferTable('categories')!, unrelated, 'a', 'actor', false)).rejects.toThrow('fora do cadastro');
    vi.mocked(prisma.subcategory.findMany).mockResolvedValue([{ id: 'sc', category_id: 'other', company_id: 'a' }] as never);
    const collision = payload({ Category: [{ id: 'c' }], Subcategory: [{ id: 'sc', category_id: 'c' }] });
    await expect(repo.import(getTransferTable('categories')!, collision, 'a', 'actor', false)).rejects.toThrow('outro registro');
    expect(prisma.category.create).not.toHaveBeenCalled();
  });
  it('protege usuários privilegiados e remove acesso a outras empresas na migração', async () => {
    const elevated = payload({ User: [{ id: 'u', role: 'SUPER_ADMIN', company_id: 'source' }] });
    await expect(repo.import(getTransferTable('users')!, elevated, 'a', 'actor', false)).rejects.toThrow('super administrador');
    const ordinary = payload({ User: [{ id: 'u', role: 'DEFAULT', company_id: 'source', all_companies_access: true, allowed_company_ids: ['foreign'], created_by: 'source-author' }] });
    await repo.import(getTransferTable('users')!, ordinary, 'a', 'actor', false);
    expect(prisma.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ role: 'DEFAULT', company_id: 'a', all_companies_access: false, allowed_company_ids: [], created_by: null }) });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u', company_id: 'a' }, data: { created_by: 'actor' } });
  });
  it('religa transações filhas somente depois de criar todas as transações', async () => {
    const input = payload({ Transaction: [{ id: 'child', company_id: 'source', parent_transaction_id: 'parent' }, { id: 'parent', company_id: 'source', parent_transaction_id: null }] });
    await repo.import(getTransferTable('transactions')!, input, 'a', 'actor', false);
    expect(prisma.transaction.create).toHaveBeenCalledWith({ data: { id: 'child', company_id: 'a', parent_transaction_id: null } });
    expect(prisma.transaction.update).toHaveBeenLastCalledWith({ where: { id: 'child', company_id: 'a' }, data: { parent_transaction_id: 'parent' } });
    expect(vi.mocked(prisma.transaction.create).mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(prisma.transaction.update).mock.invocationCallOrder[0]);
  });
});

describe('o mesmo JSON em empresas diferentes', () => {
  let database: Map<string, Map<string, Record<string, unknown>>>;
  beforeEach(() => {
    state.delegates.clear();
    state.transaction.mockClear();
    database = new Map();
    for (const model of ['Category', 'Subcategory', 'Transaction']) {
      const rows = new Map<string, Record<string, unknown>>();
      database.set(model, rows);
      const key = model[0].toLowerCase() + model.slice(1);
      const methods = (prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[key];
      const matching = (where: Record<string, unknown>) => [...rows.values()].filter(row =>
        (!where.company_id || row.company_id === where.company_id) &&
        (!where.id || (typeof where.id === 'object' ? (where.id as { in: string[] }).in.includes(String(row.id)) : row.id === where.id)));
      methods.findMany.mockImplementation(async ({ where }) => matching(where));
      methods.findFirst.mockImplementation(async ({ where }) => matching(where)[0] ?? null);
      methods.create.mockImplementation(async ({ data }) => {
        if (rows.has(String(data.id))) throw new Error('ID global duplicado');
        rows.set(String(data.id), structuredClone(data));
        return data;
      });
      methods.update.mockImplementation(async ({ where, data }) => {
        const owned = matching(where)[0];
        if (!owned) throw new Error('Tentativa de alterar outra empresa');
        Object.assign(owned, structuredClone(data));
        return owned;
      });
    }
  });
  const copiedPayload = (data: TransferRows): TableTransferPayload => ({
    data, meta: { app: 'nairim', formatVersion: 1, table: 'categories', company_id: 'source', exportedAt: '2026-10-07T00:00:00.000Z', counts: {}, dependencies: [] },
  });
  it('copia pais e filhos com IDs diferentes, preserva a origem e nao duplica na repeticao', async () => {
    database.get('Category')!.set('c', { id: 'c', company_id: 'source', name: 'Original' });
    const input = copiedPayload({ Category: [{ id: 'c', company_id: 'source', name: 'Reforma', type: 'EXPENSE' }], Subcategory: [{ id: 's', company_id: 'source', category_id: 'c', name: 'Materiais' }] });
    expect(await repo.import(getTransferTable('categories')!, input, 'wagner', 'actor', false)).toEqual({ created: 2, updated: 0 });
    expect(await repo.import(getTransferTable('categories')!, input, 'rosana', 'actor', false)).toEqual({ created: 2, updated: 0 });
    expect(await repo.import(getTransferTable('categories')!, input, 'rosana', 'actor', false)).toEqual({ created: 0, updated: 2 });
    const categories = database.get('Category')!;
    expect(categories.size).toBe(3);
    expect(categories.get('c')!.name).toBe('Original');
    expect(tableTransferCopyId('wagner', 'Category', 'c')).not.toBe(tableTransferCopyId('rosana', 'Category', 'c'));
    for (const company of ['wagner', 'rosana']) {
      expect(database.get('Subcategory')!.get(tableTransferCopyId(company, 'Subcategory', 's'))).toMatchObject({ company_id: company, category_id: tableTransferCopyId(company, 'Category', 'c') });
    }
    expect(input.data.Category[0].id).toBe('c');
  });
  it('religa todas as subcategorias a categoria copiada em uma importacao anterior', async () => {
    const categoryId = tableTransferCopyId('rosana', 'Category', 'c');
    database.get('Category')!.set(categoryId, { id: categoryId, company_id: 'rosana', name: 'Reforma' });
    const input = copiedPayload({ Subcategory: ['s1', 's2'].map(id => ({ id, company_id: 'source', category_id: 'c', name: id })) });
    expect(await repo.import(getTransferTable('subcategories')!, input, 'rosana', 'actor', false)).toEqual({ created: 2, updated: 0 });
    expect([...database.get('Subcategory')!.values()].every(row => row.category_id === categoryId)).toBe(true);
  });
  it('mantem IDs de registros ja importados pela versao anterior no destino', async () => {
    database.get('Category')!.set('c', { id: 'c', company_id: 'wagner', name: 'Antes' });
    const input = copiedPayload({ Category: [{ id: 'c', company_id: 'source', name: 'Depois', type: 'EXPENSE' }] });
    expect(await repo.import(getTransferTable('categories')!, input, 'wagner', 'actor', false)).toEqual({ created: 0, updated: 1 });
    expect(database.get('Category')!.size).toBe(1);
    expect(database.get('Category')!.get('c')!.name).toBe('Depois');
  });
  it('nao usa uma categoria da outra empresa para atender uma dependencia', async () => {
    database.get('Category')!.set('c', { id: 'c', company_id: 'wagner', name: 'Protegida' });
    const input = copiedPayload({ Subcategory: [{ id: 's', company_id: 'source', category_id: 'c', name: 'Materiais' }] });
    await expect(repo.import(getTransferTable('subcategories')!, input, 'rosana', 'actor', false)).rejects.toThrow('importe primeiro');
    expect(database.get('Subcategory')!.size).toBe(0);
    expect(database.get('Category')!.get('c')!.name).toBe('Protegida');
  });
  it('preserva o vinculo entre lancamentos pais e filhos ao copiar para outra empresa', async () => {
    const input = copiedPayload({ Transaction: [{ id: 'child', company_id: 'source', parent_transaction_id: 'parent' }, { id: 'parent', company_id: 'source', parent_transaction_id: null }] });
    expect(await repo.import(getTransferTable('transactions')!, input, 'rosana', 'actor', false)).toEqual({ created: 2, updated: 0 });
    const childId = tableTransferCopyId('rosana', 'Transaction', 'child');
    const parentId = tableTransferCopyId('rosana', 'Transaction', 'parent');
    expect(database.get('Transaction')!.get(childId)).toMatchObject({ company_id: 'rosana', parent_transaction_id: parentId });
    expect(database.get('Transaction')!.has(parentId)).toBe(true);
  });
});