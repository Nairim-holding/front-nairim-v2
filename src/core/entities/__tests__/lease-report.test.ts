import { describe, expect, it } from 'vitest';
import {
  buildRedemptionRows,
  computeNetAmount,
  computeRedemptionPayable,
  creditMonthOf,
  monthsOfQuarter,
  quartersOf,
  round2,
  MONTHLY_DARF_RATES,
  QUARTERLY_DARF_RATES,
  WITHHOLDING_RATES,
  WITHHOLDING_TOTAL_RATE,
} from '@/core/entities/lease-report';

/**
 * Os números conferidos aqui são os da planilha que o cliente enviou junto com
 * a especificação (doc "36 - Implementações sistema Nairim - 23-08-26"). São o
 * critério de aceite do relatório: se uma alíquota ou uma fórmula mudar sem
 * querer, o teste aponta exatamente qual quadro saiu do lugar.
 */

// Único imóvel com IRRF da carteira, no mês do documento.
const WITHHOLDING_BASE = 21562.06;
// Faturamento total de aluguéis do mesmo mês.
const MONTHLY_REVENUE = 34184.88;
// Faturamento do trimestre.
const QUARTERLY_REVENUE = 102477.09;

describe('mês de referência', () => {
  it('credita o aluguel no mês seguinte ao de referência', () => {
    expect(creditMonthOf({ year: 2025, month: 12 })).toEqual({ year: 2026, month: 1 });
    expect(creditMonthOf({ year: 2026, month: 1 })).toEqual({ year: 2026, month: 2 });
  });

  it('agrupa os meses selecionados em trimestres-calendário distintos', () => {
    const quarters = quartersOf([
      { year: 2025, month: 7 },
      { year: 2025, month: 9 },
      { year: 2025, month: 11 },
    ]);
    expect(quarters).toEqual([
      { year: 2025, quarter: 3 },
      { year: 2025, quarter: 4 },
    ]);
  });

  it('expande um trimestre nos seus três meses', () => {
    expect(monthsOfQuarter({ year: 2025, quarter: 4 })).toEqual([
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
    ]);
  });
});

describe('quadro Retenções dos Aluguéis', () => {
  it('reproduz os valores retidos da planilha', () => {
    expect(round2(WITHHOLDING_BASE * WITHHOLDING_RATES.pis)).toBe(140.15);
    expect(round2(WITHHOLDING_BASE * WITHHOLDING_RATES.cofins)).toBe(646.86);
    expect(round2(WITHHOLDING_BASE * WITHHOLDING_RATES.irpj)).toBe(1034.98);
    expect(round2(WITHHOLDING_BASE * WITHHOLDING_RATES.csll)).toBe(215.62);
  });

  it('soma 9,45% e bate com o total retido', () => {
    expect(WITHHOLDING_TOTAL_RATE).toBeCloseTo(0.0945, 10);
    expect(round2(WITHHOLDING_BASE * WITHHOLDING_TOTAL_RATE)).toBe(2037.61);
  });
});

describe('quadro DARF mensal', () => {
  it('apura PIS e COFINS sobre o faturamento e abate a retenção', () => {
    const pis = round2(MONTHLY_REVENUE * MONTHLY_DARF_RATES.pis);
    const cofins = round2(MONTHLY_REVENUE * MONTHLY_DARF_RATES.cofins);
    expect(pis).toBe(222.2);
    expect(cofins).toBe(1025.55);

    expect(round2(pis - round2(WITHHOLDING_BASE * WITHHOLDING_RATES.pis))).toBe(82.05);
    expect(round2(cofins - round2(WITHHOLDING_BASE * WITHHOLDING_RATES.cofins))).toBe(378.69);
  });
});

describe('quadro DARF trimestral', () => {
  it('usa as alíquotas efetivas do lucro presumido (32%)', () => {
    expect(QUARTERLY_DARF_RATES.csll).toBeCloseTo(0.0288, 10);
    expect(QUARTERLY_DARF_RATES.irpj).toBeCloseTo(0.048, 10);
  });

  it('abate a retenção dos três meses do trimestre', () => {
    const csll = round2(QUARTERLY_REVENUE * QUARTERLY_DARF_RATES.csll);
    const irpj = round2(QUARTERLY_REVENUE * QUARTERLY_DARF_RATES.irpj);
    expect(csll).toBe(2951.34);
    expect(irpj).toBe(4918.9);

    // 3 meses × a retenção mensal do mesmo imposto.
    const csllWithheld = round2(WITHHOLDING_BASE * 3 * WITHHOLDING_RATES.csll);
    const irpjWithheld = round2(WITHHOLDING_BASE * 3 * WITHHOLDING_RATES.irpj);
    expect(round2(csll - csllWithheld)).toBe(2304.48);
    expect(round2(irpj - irpjWithheld)).toBe(1813.96);
  });
});

describe('valor líquido', () => {
  it('soma créditos e subtrai débitos na fórmula do cliente', () => {
    const net = computeNetAmount({
      gross_revenue: 1000,
      received_amount: 1000,
      penalty: 50,
      property_tax_refund: 30,
      discount_expense: 20,
      withholding: 94.5,
      agency_share: 100,
    });
    // 1000 + 50 + 30 − 20 − 94,50 − 100
    expect(net).toBe(865.5);
  });

  it('usa o valor recebido, não a receita bruta — parcela em aberto não entra no líquido', () => {
    const net = computeNetAmount({
      gross_revenue: 1000,
      received_amount: 0,
      penalty: 0,
      property_tax_refund: 0,
      discount_expense: 0,
      withholding: 0,
      agency_share: 100,
    });
    expect(net).toBe(-100);
  });
});

describe('quadro Resgate de Aplicações Financeiras', () => {
  it('cobra CSLL integral e abate o IR retido só do IRPJ', () => {
    const input = { year: 2025, quarter: 4, income: 10000, tax_withheld: 800 };
    expect(computeRedemptionPayable('csll', input)).toBe(900); // 10.000 × 9%
    expect(computeRedemptionPayable('irpj', input)).toBe(700); // 10.000 × 15% − 800
  });

  it('não devolve imposto quando o IR retido supera o devido', () => {
    const input = { year: 2025, quarter: 4, income: 1000, tax_withheld: 500 };
    expect(computeRedemptionPayable('irpj', input)).toBe(0);
  });

  it('monta duas linhas por trimestre, zeradas quando nada foi digitado', () => {
    const rows = buildRedemptionRows([{ year: 2025, quarter: 4 }], []);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.tax)).toEqual(['csll', 'irpj']);
    expect(rows.every((r) => r.payable === 0 && r.income === 0)).toBe(true);
  });
});
