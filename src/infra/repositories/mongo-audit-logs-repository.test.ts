import { beforeEach, expect, it, vi } from 'vitest';
import { runWithTenant } from '@/infra/database/tenant-context';

const mocks = vi.hoisted(() => ({ find: vi.fn(), findOne: vi.fn(), count: vi.fn(), sort: vi.fn(), aggregate: vi.fn(), repair: vi.fn(), investment: vi.fn(), supplier: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: { repair: { findMany: mocks.repair }, investment: { findMany: mocks.investment }, supplier: { findMany: mocks.supplier } } }));
vi.mock('@/infra/database/mongodb', () => ({ logsCollection: async () => ({ find: mocks.find, findOne: mocks.findOne, countDocuments: mocks.count, aggregate: mocks.aggregate }) }));
import { MongoAuditLogsRepository } from './mongo-audit-logs-repository';
const repo = new MongoAuditLogsRepository();
beforeEach(() => {
  vi.clearAllMocks();
  const cursor = { sort: mocks.sort, skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) };
  mocks.sort.mockReturnValue(cursor); mocks.find.mockReturnValue(cursor);
  mocks.aggregate.mockReturnValue({ toArray: async () => [{ table_name: 'RepairItem', user_name: 'Usuário', user_email: 'user@example.test' }] });
  mocks.repair.mockResolvedValue([{ id: 'repair', description: 'Reforma da casa' }]);
  mocks.investment.mockResolvedValue([{ id: 'investment', product: 'PGBL' }]);
  mocks.supplier.mockResolvedValue([{ id: 'supplier', legal_name: 'Agnaldo', trade_name: null }]);
  mocks.count.mockResolvedValue(0); mocks.findOne.mockResolvedValue(null);
});
it('fails closed without a tenant', async () => {
  await expect(repo.list({})).rejects.toThrow('Contexto de empresa');
  await expect(repo.findById('x')).rejects.toThrow('Contexto de empresa');
  expect(mocks.find).not.toHaveBeenCalled();
});
it('scopes detail lookup even with a known foreign UUID', async () => {
  await runWithTenant('company-a', () => repo.findById('foreign-id'));
  expect(mocks.findOne).toHaveBeenCalledWith({ company_id: 'company-a', id: 'foreign-id' });
});
it('escapes regular expressions and ignores injected tenant filters', async () => {
  await runWithTenant('a', () => repo.list({ search: '.*', filters: { company_id: 'b' }, sortOptions: { created_at: 'desc' } }));
  expect(mocks.find).toHaveBeenCalledWith({ company_id: 'a', $or: [
    { user_name: { $regex: '\\.\\*', $options: 'i' } }, { user_email: { $regex: '\\.\\*', $options: 'i' } },
  ] });
  expect(mocks.sort).toHaveBeenCalledWith({ created_at: -1, id: -1 });
});

it.each(['EXPORT', 'IMPORT'])('shows %s operation metadata without unrelated business fields', async action => {
  mocks.findOne.mockResolvedValue({ id: 'operation', company_id: 'a', table_name: 'Property', action, created_at: new Date(),
    new_values: { description: 'Transferência', format: 'JSON', record_count: 0, created_count: 0, record_counts: { Repair: 1, RepairItem: 2 } } });
  const result=await runWithTenant('a',()=>repo.findById('operation'));
  expect(result?.action_label).toBe(action==='EXPORT'?'Exportação':'Importação');
  expect(result?.changed_fields.map(field=>field.field).sort()).toEqual(['description','format','record_count','created_count','record_counts'].sort());
  expect(result?.changed_fields.find(field=>field.field==='record_count')?.new_value).toBe(0);
  expect(result?.changed_fields.find(field=>field.field==='record_counts')?.new_value).toBe('Reparo do imóvel: 1; Item do reparo: 2');
});
it('identifies repair items, related repair/professional and currency', async () => {
  mocks.findOne.mockResolvedValue({ id: 'item-log', company_id: 'a', table_name: 'RepairItem', action: 'CREATE', created_at: new Date(),
    new_values: { description: 'Trocar janelas', repair_id: 'repair', supplier_id: 'supplier', professional: 'Agnaldo', kind: 'LABOR', amount: '1500.00' } });
  const result=await runWithTenant('a',()=>repo.findById('item-log'));
  expect(result?.table_label).toBe('Item do reparo');
  expect(result?.record_label).toBe('Trocar janelas');
  const value=(field: string)=>result?.changed_fields.find(item=>item.field===field)?.new_value;
  expect(value('repair_id')).toBe('Reforma da casa'); expect(value('supplier_id')).toBe('Agnaldo'); expect(value('kind')).toBe('Mão de obra');
  expect(String(value('amount')).replace(/\s/g,' ')).toBe('R$ 1.500,00');
});
it('translates multiple repair problems and investment amounts', async () => {
  mocks.findOne.mockResolvedValue({ id:'repair-log',company_id:'a',table_name:'Repair',action:'UPDATE',created_at:new Date(),old_values:{},new_values:{problem_types:['HYDRAULIC','FINISHING'],service_amount:'1500.00'} });
  const repair=await runWithTenant('a',()=>repo.findById('repair-log'));
  expect(repair?.changed_fields.find(field=>field.field==='problem_types')?.new_value).toBe('Hidráulico, Revestimento e acabamento');
  mocks.findOne.mockResolvedValue({ id:'balance-log',company_id:'a',table_name:'InvestmentMonthBalance',action:'CREATE',created_at:new Date(),new_values:{investment_id:'investment',balance:'1148951.94'} });
  const balance=await runWithTenant('a',()=>repo.findById('balance-log'));
  expect(balance?.table_label).toBe('Saldo mensal do investimento');
  expect(balance?.changed_fields.find(field=>field.field==='investment_id')?.new_value).toBe('PGBL');
  expect(String(balance?.changed_fields.find(field=>field.field==='balance')?.new_value).replace(/\s/g,' ')).toBe('R$ 1.148.951,94');
});
it('includes transfer actions and translated new models in filter options', async () => {
  const result=await runWithTenant('a',()=>repo.getFilters({}));
  expect(result.filters.find(field=>field.field==='action')?.options).toEqual(expect.arrayContaining([{value:'EXPORT',label:'Exportação'},{value:'IMPORT',label:'Importação'}]));
  expect(result.filters.find(field=>field.field==='table_name')?.options).toContainEqual({value:'RepairItem',label:'Item do reparo'});
});
