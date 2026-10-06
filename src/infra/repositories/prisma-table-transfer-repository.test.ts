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
import { PrismaTableTransferRepository } from './prisma-table-transfer-repository';
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
