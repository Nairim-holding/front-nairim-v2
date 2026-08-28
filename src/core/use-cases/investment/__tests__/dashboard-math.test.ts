import { describe, expect, it } from 'vitest';
import {
  buildSummary,
  expandMonths,
  monthKey,
  resolveBalanceSeries,
} from '@/core/use-cases/investment/dashboard-math';

/**
 * Os números deste arquivo saíram do layout aprovado da tela — é a única forma
 * de garantir que "Rendimento Mensal" e "Saldo Total" continuem batendo com o
 * que o cliente valida na grid, já que o cálculo não passa por nenhum endpoint
 * de terceiros que pudesse servir de referência.
 */

const MONTHS = expandMonths('2024-08', '2025-01');

function map(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries));
}

describe('expandMonths', () => {
  it('inclui os dois extremos e vira o ano', () => {
    expect(MONTHS).toEqual([
      { year: 2024, month: 8 },
      { year: 2024, month: 9 },
      { year: 2024, month: 10 },
      { year: 2024, month: 11 },
      { year: 2024, month: 12 },
      { year: 2025, month: 1 },
    ]);
  });

  it('devolve vazio quando o período está invertido', () => {
    expect(expandMonths('2025-01', '2024-08')).toEqual([]);
  });
});

describe('resolveBalanceSeries', () => {
  it('deixa em branco os meses anteriores ao primeiro movimento', () => {
    const series = resolveBalanceSeries(MONTHS, map({ '2025-01': 1000 }), new Map());

    expect(series.get('2024-08')).toBeNull();
    expect(series.get('2024-12')).toBeNull();
    // Investimento novo, sem saldo digitado: o saldo do mês é o próprio aporte.
    expect(series.get('2025-01')).toBe(1000);
  });

  it('usa o saldo informado no lugar do herdado', () => {
    const series = resolveBalanceSeries(MONTHS, map({ '2025-01': 1000 }), map({ '2025-01': 1010 }));
    expect(series.get('2025-01')).toBe(1010);
  });

  it('herda o saldo do mês anterior somado ao aporte do mês', () => {
    // Caso PETR4 do layout: saldo de nov informado, aporte de 500 em dez.
    const series = resolveBalanceSeries(
      MONTHS,
      map({ '2024-12': 500 }),
      map({ '2024-11': 97615.2, '2025-01': 99577.27 }),
    );

    expect(series.get('2024-12')).toBe(98115.2);
    expect(series.get('2025-01')).toBe(99577.27);
  });
});

describe('buildSummary', () => {
  it('desconta o aporte do rendimento do mês', () => {
    // Sem o desconto, dezembro apareceria 500 mais rentável do que foi.
    const applied = map({ '2024-12': 500 });
    const balances = resolveBalanceSeries(
      MONTHS,
      applied,
      map({ '2024-11': 1000, '2024-12': 1600, '2025-01': 1650 }),
    );

    const summary = buildSummary(MONTHS, [{ balances, applied }], 8000);
    const dezembro = summary.find((row) => row.month === 12)!;
    const janeiro = summary.find((row) => row.month === 1)!;

    expect(dezembro.total_applied).toBe(500);
    expect(dezembro.total_balance).toBe(1600);
    // 1600 − 1000 − 500 = 100 (e não 600).
    expect(dezembro.yield_amount).toBe(100);
    expect(janeiro.yield_amount).toBe(50);
  });

  it('calcula o grau de independência sobre o valor de referência', () => {
    // Layout: rendimento 2.821,11 sobre referência 20.000 = 14,11%.
    const balances = new Map<string, number | null>([
      [monthKey(2024, 7), 100000],
      [monthKey(2024, 8), 102821.11],
    ]);
    const summary = buildSummary([{ year: 2024, month: 8 }], [{ balances, applied: new Map() }], 20000);

    expect(summary[0].yield_amount).toBe(2821.11);
    expect(summary[0].independence_degree).toBe(14.11);
  });

  it('zera o grau quando não há referência configurada nem gastos planejados', () => {
    const balances = new Map<string, number | null>([[monthKey(2024, 8), 500]]);
    const summary = buildSummary([{ year: 2024, month: 8 }], [{ balances, applied: new Map() }], 0);

    expect(summary[0].independence_degree).toBe(0);
  });

  it('soma todos os investimentos em cada linha do cabeçalho', () => {
    const a = {
      balances: resolveBalanceSeries(MONTHS, map({ '2024-08': 100 }), map({ '2024-08': 100, '2024-09': 110 })),
      applied: map({ '2024-08': 100 }),
    };
    const b = {
      balances: resolveBalanceSeries(MONTHS, map({ '2024-08': 200 }), map({ '2024-08': 200, '2024-09': 230 })),
      applied: map({ '2024-08': 200 }),
    };

    const setembro = buildSummary(MONTHS, [a, b], 8000).find((row) => row.month === 9)!;

    expect(setembro.total_balance).toBe(340);
    expect(setembro.total_applied).toBe(0);
    expect(setembro.yield_amount).toBe(40);
  });
});
