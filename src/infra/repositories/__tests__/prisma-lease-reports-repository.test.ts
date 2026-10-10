import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, findLeases } = vi.hoisted(() => ({ findMany: vi.fn(), findLeases: vi.fn() }));

vi.mock('@/infra/database/prisma', () => ({
  default: { transaction: { findMany }, lease: { findMany: findLeases } },
}));

import { PrismaLeaseReportsRepository } from '@/infra/repositories/prisma-lease-reports-repository';
import { runWithReportingCompanies } from '@/infra/database/reporting-context';

describe('PrismaLeaseReportsRepository', () => {
  it('batches 100 companies and keeps matching contract numbers within each company', async () => {
    const lease = (company_id: string) => ({ company_id, id: `lease-${company_id}`, contract_number: '123', start_date: new Date('2020-01-01'), end_date: new Date('2030-12-31'), canceled_at: null, discount_amount: null, agency: { trade_name: company_id }, property: { title: company_id, income_tax_withholding: false, agency: null }, tenant: { name: company_id, cpf: null, cnpj: null } });
    findLeases.mockResolvedValue([lease('a'), lease('b')]);
    findMany.mockResolvedValue([
      { id: 'tx-a', company_id: 'a', description: 'Aluguel Contrato 123', amount: 1000, effective_date: new Date('2025-01-10'), category: { type: 'INCOME' } },
      { id: 'tx-b', company_id: 'b', description: 'Aluguel Contrato 123', amount: 2000, effective_date: new Date('2025-01-10'), category: { type: 'INCOME' } },
    ]);
    const report = await runWithReportingCompanies(Array.from({ length: 100 }, (_, i) => `${i}`), () => new PrismaLeaseReportsRepository().getLeaseReport({ months: [{ year: 2025, month: 1 }, { year: 2025, month: 2 }] }));
    expect(report.rows.map(row => [row.lease_id, row.gross_revenue])).toEqual([['lease-a', 1000], ['lease-b', 2000]]);
    expect(findMany).toHaveBeenCalledTimes(2); expect(findLeases).toHaveBeenCalledTimes(2);
  });
  beforeEach(() => {
    findMany.mockReset();
    findLeases.mockReset();
    findLeases.mockResolvedValue([{
      id: 'lease-rafael-55', contract_number: '123', start_date: new Date('2020-01-01'),
      end_date: new Date('2030-12-31'), canceled_at: null, discount_amount: null,
      agency: { trade_name: 'Imobiliária' },
      property: { title: 'AV. DR. RAFAEL PAES DE BARROS, 55', income_tax_withholding: true, agency: null },
      tenant: { name: 'Locatário', cpf: null, cnpj: null },
    }]);
  });

  it('consulta somente recebimentos do próprio mês e calcula retenção e líquido', async () => {
    findMany
      .mockResolvedValueOnce([
        {
          amount: 21_562.06,
          description: 'Aluguel do imóvel 1/12 – Contrato 123',
          is_cancellation_charge: false,
          lease_id: 'lease-rafael-55',
          lease: {
            id: 'lease-rafael-55',
            discount_amount: null,
            agency: { trade_name: 'Imobiliária' },
            property: {
              title: 'AV. DR. RAFAEL PAES DE BARROS, 55',
              income_tax_withholding: true,
              agency: null,
            },
            tenant: { name: 'Locatário', cpf: null, cnpj: '12.345.678/0001-90' },
          },
        },
      ])
      // A apuração trimestral consulta os outros dois meses do trimestre.
      .mockResolvedValue([]);

    const report = await new PrismaLeaseReportsRepository().getLeaseReport({
      months: [{ year: 2025, month: 9 }],
    });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      property_title: 'AV. DR. RAFAEL PAES DE BARROS, 55',
      gross_revenue: 21_562.06,
      received_amount: 21_562.06,
      withholding: 2_037.61,
      net_amount: 19_524.45,
    });
    expect(report.withholding).toMatchObject({ base: 21_562.06, total: 2_037.61 });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      status: 'COMPLETED', deleted_at: null, is_transfer: false,
      effective_date: { gte: new Date('2025-09-01T00:00:00Z'), lte: new Date('2025-09-30T00:00:00Z') },
    });
  });

  it('recupera IPTU e multa avulsos sem duplicar a multa no líquido', async () => {
    const tx = (description: string, amount: number, lease_id: string | null = null) => ({
      id: description, description, amount, lease_id, is_cancellation_charge: false,
      effective_date: new Date('2026-04-10T00:00:00Z'), category: { type: 'INCOME' },
    });
    findMany.mockResolvedValueOnce([
      tx('Aluguel 1/12', 1000, 'lease-rafael-55'),
      tx('Restituição IPTU – Contrato 123', 45.63),
      tx('Multa Contrato 123', 100),
      tx('Restituição IPTU Contrato 1234', 999),
      tx('Restituição caução Contrato 123', 500),
      { ...tx('Pagamento IPTU Contrato 123', 800), category: { type: 'EXPENSE' } },
    ]).mockResolvedValue([]);
    const report = await new PrismaLeaseReportsRepository().getLeaseReport({ months: [{ year: 2026, month: 4 }] });
    expect(report.totals).toMatchObject({ gross_revenue: 1000, received_amount: 1100, penalty: 100, property_tax_refund: 45.63, net_amount: 1051.13 });
    expect(report.monthlyDarf[0].revenue).toBe(1100);
    expect(report.unmatched).toHaveLength(1);
    expect(report.unmatched?.[0].amount).toBe(999);
  });

  it('prioriza a retenção lançada e não aplica retenção a outro mês sem indicação', async () => {
    const leases = await findLeases();
    leases[0].property.income_tax_withholding = false;
    findLeases.mockResolvedValue(leases);
    findMany.mockImplementation(async ({ where }) => {
      const month = where.effective_date.gte.getUTCMonth() + 1;
      if (month === 6) return [];
      const rent = {
        id: `rent-${month}`, amount: 1000, description: 'Aluguel Contrato 123',
        lease_id: 'lease-rafael-55', is_cancellation_charge: false,
        effective_date: new Date(`2026-0${month}-10T00:00:00Z`), category: { type: 'INCOME' },
      };
      return month === 4 ? [rent, {
        ...rent, id: 'irrf', lease_id: null, description: 'IRRF retido Aluguel - Contrato 123',
        amount: 90, category: { type: 'EXPENSE' },
      }] : [rent];
    });
    const report = await new PrismaLeaseReportsRepository().getLeaseReport({
      months: [{ year: 2026, month: 5 }, { year: 2026, month: 4 }, { year: 2026, month: 4 }],
    });
    expect(report.rows[0]).toMatchObject({ has_withholding: true, withholding: 90, net_amount: 910 });
    expect(report.rows).toHaveLength(2);
    expect(report.rows[1]).toMatchObject({ reference_month: '2026-05', withholding: 0, net_amount: 1000 });
    expect(report.totals.net_amount).toBe(1910);
    expect(report.withholding).toMatchObject({ base: 1000, total: 90 });
    expect(report.warnings).toHaveLength(1);
    expect(report.months).toHaveLength(2);
    expect(report.monthlyDarf.find((row) => row.reference.month === 5 && row.tax === 'pis')?.withheld).toBe(0);
    expect(report.quarterlyDarf[0].revenue).toBe(2000);
    expect(findMany).toHaveBeenCalledTimes(3);
  });
});

it('separa três competências recebidas no mesmo mês e prioriza condomínio financeiro sobre o cadastro', async () => {
  findLeases.mockResolvedValue([{id:'lease',company_id:'a',contract_number:'123',start_date:new Date('2020-01-01'),end_date:new Date('2030-12-31'),canceled_at:null,
    discount_amount:100,condo_fee:100,agency:{trade_name:'Adiplan'},property:{title:'América, 389',income_tax_withholding:false,agency:null},tenant:{name:'Locatário',cpf:null,cnpj:null}}]);
  const tx=(month:number,description:string,amount:number,type='INCOME')=>({id:description+month,company_id:'a',lease_id:'lease',description,amount,event_date:new Date(`2026-${String(month).padStart(2,'0')}-01`),effective_date:new Date('2026-09-10'),is_cancellation_charge:false,category:{type}});
  findMany.mockResolvedValueOnce([tx(6,'Aluguel',1800),tx(7,'Aluguel',1800),tx(8,'Aluguel',1800),tx(6,'Condomínio',120),tx(6,'Pagamento condomínio',500,'EXPENSE')]).mockResolvedValue([]);
  const report=await new PrismaLeaseReportsRepository().getLeaseReport({months:[{year:2026,month:9}]});
  expect(report.rows.map(row=>[row.reference_month,row.condominium_income,row.net_amount])).toEqual([['2026-06',120,1820],['2026-07',100,1800],['2026-08',100,1800]]);
  expect(new Set(report.rows.map(row=>row.row_id)).size).toBe(3);
  expect(report.totals).toMatchObject({gross_revenue:5400,condominium_income:320,discount_expense:300,net_amount:5420});
  expect(report.monthlyDarf[0].revenue).toBe(5400);
});

it('associa recebimento atrasado sem vínculo à locação vigente na competência', async () => {
  findLeases.mockResolvedValue([{id:'old-lease',company_id:'a',contract_number:'123',start_date:new Date('2020-01-01'),end_date:new Date('2026-06-30'),canceled_at:null,
    discount_amount:0,condo_fee:0,agency:null,property:{title:'Rua América, 389',income_tax_withholding:false,agency:null},tenant:{name:'Locatário anterior',cpf:null,cnpj:null}}]);
  findMany.mockResolvedValueOnce([{id:'late-rent',company_id:'a',lease_id:null,description:'Aluguel Rua América, 389',amount:1800,event_date:new Date('2026-06-01'),effective_date:new Date('2026-09-10'),is_cancellation_charge:false,category:{type:'INCOME'}}]).mockResolvedValue([]);
  const report=await new PrismaLeaseReportsRepository().getLeaseReport({months:[{year:2026,month:9}]});
  expect(report.rows).toHaveLength(1);
  expect(report.rows[0]).toMatchObject({lease_id:'old-lease',reference_month:'2026-06',gross_revenue:1800});
  expect(report.unmatched).toHaveLength(0);
});
