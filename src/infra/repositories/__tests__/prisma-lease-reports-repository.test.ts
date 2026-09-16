import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, findLeases } = vi.hoisted(() => ({ findMany: vi.fn(), findLeases: vi.fn() }));

vi.mock('@/infra/database/prisma', () => ({
  default: { transaction: { findMany }, lease: { findMany: findLeases } },
}));

import { PrismaLeaseReportsRepository } from '@/infra/repositories/prisma-lease-reports-repository';

describe('PrismaLeaseReportsRepository', () => {
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
    expect(report.rows[0]).toMatchObject({ has_withholding: true, withholding: 90, net_amount: 1910 });
    expect(report.withholding).toMatchObject({ base: 1000, total: 90 });
    expect(report.warnings).toHaveLength(1);
    expect(report.months).toHaveLength(2);
    expect(report.monthlyDarf.find((row) => row.reference.month === 5 && row.tax === 'pis')?.withheld).toBe(0);
    expect(report.quarterlyDarf[0].revenue).toBe(2000);
    expect(findMany).toHaveBeenCalledTimes(3);
  });
});
