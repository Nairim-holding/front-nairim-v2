import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('@/infra/database/prisma', () => ({
  default: { transaction: { findMany } },
}));

import { PrismaLeaseReportsRepository } from '@/infra/repositories/prisma-lease-reports-repository';

describe('PrismaLeaseReportsRepository', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it('preenche recebido, retenção e líquido para o lançamento de aluguel ainda pendente', async () => {
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
  });
});
