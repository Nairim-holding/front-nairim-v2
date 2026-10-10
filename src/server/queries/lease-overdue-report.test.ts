import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ transactions: vi.fn(), leases: vi.fn(), permission: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: { transaction: { findMany: mocks.transactions }, lease: { findMany: mocks.leases } } }));
vi.mock('@/infra/auth/session', () => ({ withPermission: mocks.permission }));
vi.mock('@/infra/auth/reporting-scope', () => ({ withReportingScope: async (_session: unknown, _raw: unknown, fn: () => unknown) => fn() }));
import { getOverdueLeaseReportData } from './lease-overdue-report';
beforeEach(() => { vi.resetAllMocks(); mocks.permission.mockImplementation(async (_resource,_action,fn) => fn({})); });
it('inclui pendências de contratos encerrados e mantém competências e empresas separadas', async () => {
  const lease=(company_id:string) => ({id:'lease-'+company_id,company_id,contract_number:'123',start_date:new Date('2020-01-01'),end_date:new Date('2025-12-31'),canceled_at:new Date('2025-12-31'),agency:{trade_name:'Imobiliária '+company_id},property:{title:'Casa '+company_id,agency:null},tenant:{name:'Locatário '+company_id}});
  mocks.leases.mockResolvedValue([lease('a'),lease('b')]);
  const tx=(company_id:string,description:string,lease_id:string|null,amount:number) => ({id:company_id+description,company_id,lease_id,description,amount,event_date:new Date('2025-11-01'),effective_date:new Date('2025-12-10'),category:{type:'INCOME'},is_cancellation_charge:false});
  mocks.transactions.mockResolvedValue([tx('a','Aluguel Contrato 123',null,1800),tx('b','Aluguel', 'lease-b',2000),tx('a','Aluguel estrangeiro','lease-b',99),tx('a','Condomínio','lease-a',500)]);
  const result=await getOverdueLeaseReportData({asOf:'2026-10-09'});
  expect(result.rows.map(row=>[row.agency,row.reference,row.amount])).toEqual([['Imobiliária a','11/2025',1800],['Imobiliária b','11/2025',2000]]);
  expect(result.total).toBe(3800); expect(result.unmatched).toHaveLength(1);
  expect(mocks.transactions).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({status:'PENDING',deleted_at:null,is_transfer:false,effective_date:{lt:new Date('2026-10-09')}})}));
  expect(mocks.permission).toHaveBeenCalledWith('lease-reports','view',expect.any(Function));
});
it('recusa data inválida e bloqueia falta de permissão antes de consultar dados', async () => {
  await expect(getOverdueLeaseReportData({asOf:'2026-02-31'})).rejects.toThrow();
  mocks.permission.mockRejectedValue(new Error('Sem permissão'));
  await expect(getOverdueLeaseReportData({asOf:'2026-10-09'})).rejects.toThrow('Sem permissão');
  expect(mocks.transactions).not.toHaveBeenCalled();
});
