import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TaxPanels from '../_components/TaxPanels';
import { buildLeaseReportSummaryHTML } from './printLayout';
import type { InvestmentRedemptionRow, LeaseReportResult } from '@/core/entities/lease-report';

const reference = { year: 2026, quarter: 3 };
const data: LeaseReportResult = {
  months: [{ year: 2026, month: 9 }], quarters: [reference], rows: [],
  totals: { gross_revenue: 0, received_amount: 0, discount_expense: 0, penalty: 0,
    property_tax_refund: 0, condominium_income: 0, withholding: 0, agency_share: 0, net_amount: 0 },
  withholding: { base: 0, total: 0, amounts: { pis: 0, cofins: 0, csll: 0, irpj: 0 } },
  monthlyDarf: [],
  quarterlyDarf: [{ reference, tax: 'csll', revenue: 10000, rate: 0.0288, darf: 288, withheld: 100, payable: 188 }],
};

describe('quadros fiscais das correções 53', () => {
  it.each([0, 90])('mantém tela e impressão com o mesmo imposto da aplicação (%s)', payable => {
    const redemptions: InvestmentRedemptionRow[] = [
      { reference: { year: 2025, quarter: 3 }, tax: 'csll', rate: 0.09, income: 9999, tax_withheld: 0, payable: 999 },
      { reference, tax: 'irpj', rate: 0.15, income: 1000, tax_withheld: 0, payable: 150 },
      { reference, tax: 'csll', rate: 0.09, income: 1000, tax_withheld: 0, payable },
    ];
    const screen = renderToStaticMarkup(createElement(TaxPanels, { data, redemptionRows: redemptions,
      redemptions: [], onRedemptionsChange: () => {} }));
    const print = buildLeaseReportSummaryHTML(data, redemptions);
    for (const html of [screen, print]) expect(html).toContain(`${188 + payable},00`);
  });
});
