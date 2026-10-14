import { describe, expect, it } from 'vitest';
import {
  computePropertyRoi,
  computeSaleScenario,
  leasedMonths,
  missingRoiLines,
  normalizeRoiLines,
  referencePeriodMonths,
  splitMaintenance,
  suggestRoiLines,
  type RoiCategoryOption,
  type RoiPropertyInput,
} from '@/core/entities/property-roi';

/** Números do exemplo da planilha Calculo_ROI_Imoveis_Completo.xlsx. */
const spreadsheet: RoiPropertyInput = {
  purchaseValue: 350000,
  vacancyMonths: 1,
  monthsLeased: 12,
  itbi: 10500,
  registry: 4500,
  initialRenovation: 15000,
  rentReceived: 26400,
  iptu: 1200,
  insurance: 450,
  commission: 2640,
  periodicMaintenance: 1000,
  periodMonths: 12,
};

describe('ROI por imóvel — aba "Fluxo de Caixa e ROI"', () => {
  it('reproduz os valores da planilha do cliente', () => {
    const result = computePropertyRoi(spreadsheet);

    expect(result.totalInvestment).toBe(380000);
    expect(result.monthlyRent).toBe(2200);
    expect(result.grossAnnualRevenue).toBe(26400);
    expect(result.vacancyAmount).toBe(2200);
    expect(result.netAnnualRevenue).toBe(24200);
    expect(result.totalAnnualExpenses).toBe(5290);
    expect(result.annualCashFlow).toBe(18910);
    expect(result.roi).toBeCloseTo(0.049763157894736842, 12);
    expect(result.capRate).toBeCloseTo(0.054028571428571426, 12);
    expect(result.paybackYears).toBeCloseTo(20.095187731359069, 9);
    expect(result.paybackMonths).toBeCloseTo(241.14225277630882, 8);
  });

  it('o aluguel mensal é o total recebido dividido pelos meses locado', () => {
    const result = computePropertyRoi({ ...spreadsheet, rentReceived: 22000, monthsLeased: 10 });
    expect(result.monthlyRent).toBe(2200);
  });

  it('anualiza as despesas quando o período de referência não é de 12 meses', () => {
    const result = computePropertyRoi({ ...spreadsheet, iptu: 2400, insurance: 900, commission: 5280, periodicMaintenance: 2000, periodMonths: 24 });
    expect(result.iptuAnnual).toBe(1200);
    expect(result.totalAnnualExpenses).toBe(5290);
  });

  it('sem valor de compra não inventa ROI nem Cap Rate', () => {
    const result = computePropertyRoi({ ...spreadsheet, purchaseValue: null, itbi: 0, registry: 0, initialRenovation: 0 });
    expect(result.totalInvestment).toBe(0);
    expect(result.roi).toBeNull();
    expect(result.capRate).toBeNull();
    expect(result.paybackYears).toBeNull();
  });

  it('fluxo negativo não tem payback', () => {
    const result = computePropertyRoi({ ...spreadsheet, rentReceived: 0 });
    expect(result.annualCashFlow).toBe(-5290);
    expect(result.paybackYears).toBeNull();
    expect(result.roi).toBeLessThan(0);
  });

  it('imóvel nunca locado fica com receita zero em vez de dividir por zero', () => {
    const result = computePropertyRoi({ ...spreadsheet, monthsLeased: 0 });
    expect(result.monthlyRent).toBe(0);
    expect(result.netAnnualRevenue).toBe(0);
  });
});

describe('ROI por imóvel — aba "Cenários de Valorização"', () => {
  it('reproduz os valores da planilha do cliente', () => {
    const scenario = computeSaleScenario({
      purchaseValue: 350000, totalInvestment: 380000, annualCashFlow: 18910, years: 5, appreciationRate: 0.06,
    });

    expect(scenario.projectedSalePrice).toBe(468378.95);
    expect(scenario.saleCost).toBe(28102.74);
    expect(scenario.grossProfit).toBe(60276.22);
    expect(scenario.capitalGainsTax).toBe(9041.43);
    expect(scenario.netProfit).toBe(51234.78);
    expect(scenario.globalRoi).toBeCloseTo(0.38364416519957922, 6);
  });

  it('não cobra IR quando a venda dá prejuízo', () => {
    const scenario = computeSaleScenario({
      purchaseValue: 350000, totalInvestment: 380000, annualCashFlow: 18910, years: 1, appreciationRate: 0,
    });
    expect(scenario.grossProfit).toBeLessThan(0);
    expect(scenario.capitalGainsTax).toBe(0);
  });
});

describe('ROI por imóvel — apoio', () => {
  it('mede o período de referência em meses', () => {
    expect(referencePeriodMonths('2025-10-14', '2026-10-13')).toBe(12);
    expect(referencePeriodMonths('2026-01-01', '2026-12-31')).toBe(12);
    expect(referencePeriodMonths('2025-01-01', '2026-12-31')).toBe(24);
    expect(referencePeriodMonths('2026-01-01', '2026-01-15')).toBe(0.5);
  });

  it('conta os meses locado sem dobrar contratos sobrepostos', () => {
    expect(leasedMonths([{ start: '2024-01-10', end: '2024-12-10', canceledAt: null }], '2026-10-13')).toBe(11);
    expect(leasedMonths([
      { start: '2024-01-01', end: '2024-12-31', canceledAt: null },
      { start: '2024-06-01', end: '2025-06-01', canceledAt: null },
    ], '2026-10-13')).toBe(17);
  });

  it('limita o contrato ao cancelamento e a hoje', () => {
    expect(leasedMonths([{ start: '2024-01-01', end: '2024-12-31', canceledAt: '2024-07-01' }], '2026-10-13')).toBe(6);
    expect(leasedMonths([{ start: '2026-07-13', end: '2028-07-13', canceledAt: null }], '2026-10-13')).toBe(3);
    expect(leasedMonths([{ start: '2027-01-01', end: '2028-01-01', canceledAt: null }], '2026-10-13')).toBe(0);
  });

  it('separa reforma inicial (até 1 ano da compra) da manutenção periódica do período', () => {
    const split = splitMaintenance([
      { date: '2020-03-01', amount: 15000 },  // dentro do 1º ano
      { date: '2021-01-10', amount: 5000 },   // dia do aniversário da compra ainda é inicial
      { date: '2023-05-01', amount: 700 },    // periódica, mas fora do período
      { date: '2026-02-01', amount: 1000 },   // periódica, no período
    ], '2020-01-10', { from: '2025-10-14', to: '2026-10-13' });

    expect(split).toEqual({ initial: 20000, periodic: 1000 });
  });

  it('sem data de compra toda a manutenção do período é periódica', () => {
    const split = splitMaintenance([
      { date: '2020-03-01', amount: 15000 },
      { date: '2026-02-01', amount: 1000 },
    ], null, { from: '2025-10-14', to: '2026-10-13' });

    expect(split).toEqual({ initial: 0, periodic: 1000 });
  });

  const categories: RoiCategoryOption[] = [
    { id: 'imp', name: 'Impostos', type: 'EXPENSE', subcategories: [{ id: 'itbi', name: 'ITBI' }, { id: 'iptu', name: 'IPTU' }, { id: 'reg', name: 'Registro de Imóveis' }] },
    { id: 'var', name: 'Despesas Variáveis', type: 'EXPENSE', subcategories: [{ id: 'man', name: 'Manutenção de Imóveis' }, { id: 'seg', name: 'Seguros (Imóvel / Incêndios)' }] },
    { id: 'fix', name: 'Despesas Fixas', type: 'EXPENSE', subcategories: [{ id: 'com', name: 'Comissões Imobiliárias' }] },
    { id: 'rec', name: 'Receitas', type: 'INCOME', subcategories: [{ id: 'alu', name: 'Aluguéis' }, { id: 'rest', name: 'Restituição IPTU' }] },
  ];

  it('sugere as linhas pelos nomes da planilha', () => {
    const lines = suggestRoiLines(categories);
    expect(lines.itbi).toEqual({ category_id: 'imp', subcategory_id: 'itbi' });
    expect(lines.registry).toEqual({ category_id: 'imp', subcategory_id: 'reg' });
    expect(lines.maintenance).toEqual({ category_id: 'var', subcategory_id: 'man' });
    expect(lines.rent).toEqual({ category_id: 'rec', subcategory_id: 'alu' });
    // "Restituição IPTU" é receita: não pode virar a despesa de IPTU.
    expect(lines.iptu).toEqual({ category_id: 'imp', subcategory_id: 'iptu' });
    expect(lines.insurance).toEqual({ category_id: 'var', subcategory_id: 'seg' });
    expect(lines.commission).toEqual({ category_id: 'fix', subcategory_id: 'com' });
    expect(missingRoiLines(lines)).toEqual([]);
  });

  it('não sugere quando o nome é ambíguo', () => {
    const lines = suggestRoiLines([
      { id: 'imp', name: 'Impostos', type: 'EXPENSE', subcategories: [{ id: 'a', name: 'IPTU Garça' }, { id: 'b', name: 'IPTU Marília' }] },
    ]);
    expect(lines.iptu.category_id).toBeNull();
    expect(missingRoiLines(lines)).toContain('iptu');
  });

  it('normaliza a configuração salva e descarta subcategoria sem categoria', () => {
    const lines = normalizeRoiLines({ rent: { category_id: 'rec', subcategory_id: '' }, iptu: { category_id: '', subcategory_id: 'x' }, lixo: 1 });
    expect(lines.rent).toEqual({ category_id: 'rec', subcategory_id: null });
    expect(lines.iptu).toEqual({ category_id: null, subcategory_id: null });
    expect(Object.keys(lines)).toHaveLength(7);
  });
});
