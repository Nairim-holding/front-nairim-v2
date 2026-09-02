import { describe, expect, it } from 'vitest';
import {
  accumulate12Months,
  AUTO_UPDATABLE_CODES,
  buildSgsUrl,
  formatSgsDate,
  mergeMonthlyAndAccumulated,
  parseSgsResponse,
  round4,
  SGS_SERIES,
} from '@/core/entities/adjustment-index';

describe('séries do SGS', () => {
  it('usa os códigos informados pelo cliente', () => {
    expect(SGS_SERIES['IGP-M']?.monthly).toBe(189);
    expect(SGS_SERIES.IPCA?.monthly).toBe(433);
    expect(SGS_SERIES.IPCA?.accumulated12m).toBe(13522);
    expect(SGS_SERIES.INPC?.monthly).toBe(188);
  });

  it('mantém o IVAR como manual: o BCB não publica série de aluguéis residenciais no SGS', () => {
    expect(SGS_SERIES.IVAR).toBeNull();
    expect(AUTO_UPDATABLE_CODES).toEqual(['IGP-M', 'IPCA', 'INPC']);
  });

  it('monta a URL da série, com e sem intervalo', () => {
    expect(buildSgsUrl(433)).toBe('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json');
    expect(
      buildSgsUrl(433, { from: new Date(Date.UTC(2026, 0, 1)), to: new Date(Date.UTC(2026, 11, 31)) }),
    ).toBe(
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/01/2026&dataFinal=31/12/2026',
    );
  });

  it('formata a data no padrão dd/MM/yyyy do SGS', () => {
    expect(formatSgsDate(new Date(Date.UTC(2026, 7, 5)))).toBe('05/08/2026');
  });
});

describe('parsing da resposta do BCB', () => {
  it('converte os pontos mensais', () => {
    expect(
      parseSgsResponse([
        { data: '01/01/2026', valor: '0.42' },
        { data: '01/02/2026', valor: '0.83' },
      ]),
    ).toEqual([
      { reference_year: 2026, reference_month: 1, monthly_rate: 0.42 },
      { reference_year: 2026, reference_month: 2, monthly_rate: 0.83 },
    ]);
  });

  it('aceita valor com vírgula decimal', () => {
    expect(parseSgsResponse([{ data: '01/03/2026', valor: '1,25' }])[0].monthly_rate).toBe(1.25);
  });

  it('descarta pontos inválidos em vez de gravar NaN', () => {
    expect(
      parseSgsResponse([
        { data: '01/01/2026', valor: '' },
        { data: '01/13/2026', valor: '0.5' },
        { data: '01/02/2026', valor: '0.30' },
      ]),
    ).toEqual([{ reference_year: 2026, reference_month: 2, monthly_rate: 0.3 }]);
  });
});

describe('acumulado em 12 meses', () => {
  // 12 meses de 1% compõem para 12,6825%, não para 12%.
  const twelveMonthsOfOnePercent = Array.from({ length: 12 }, (_, i) => ({
    reference_year: 2026,
    reference_month: i + 1,
    monthly_rate: 1,
  }));

  it('compõe as variações em vez de somá-las', () => {
    const accumulated = accumulate12Months(twelveMonthsOfOnePercent, {
      reference_year: 2026,
      reference_month: 12,
    });
    expect(accumulated).toBe(round4((1.01 ** 12 - 1) * 100));
    expect(accumulated).toBeCloseTo(12.6825, 4);
  });

  it('devolve null sem 12 meses completos', () => {
    expect(
      accumulate12Months(twelveMonthsOfOnePercent.slice(0, 6), { reference_year: 2026, reference_month: 6 }),
    ).toBeNull();
  });
});

describe('merge das séries mensal e acumulada', () => {
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    reference_year: 2026,
    reference_month: i + 1,
    monthly_rate: 1,
  }));

  it('prefere o acumulado publicado pelo BCB quando existe', () => {
    const merged = mergeMonthlyAndAccumulated(monthly, [
      { reference_year: 2026, reference_month: 12, monthly_rate: 11.9 },
    ]);
    expect(merged.find((m) => m.reference_month === 12)?.accumulated_12m).toBe(11.9);
  });

  it('cai para o cálculo composto quando o BCB não publica o mês', () => {
    const merged = mergeMonthlyAndAccumulated(monthly);
    expect(merged.find((m) => m.reference_month === 12)?.accumulated_12m).toBeCloseTo(12.6825, 4);
    // Sem 12 meses anteriores, o acumulado fica nulo em vez de parcial.
    expect(merged.find((m) => m.reference_month === 3)?.accumulated_12m).toBeNull();
  });
});

describe('janela de consulta ao SGS', () => {
  /**
   * Regressão: a janela não pode avançar para o mês corrente/futuro. O SGS
   * responde `{"erro":{}}` (JSON válido, status 200) em algumas séries quando
   * a data final é futura — foi o que fez o IGP-M falhar na primeira rodada,
   * enquanto IPCA e INPC passaram.
   */
  it('termina no último dia do mês anterior', () => {
    const today = new Date(2026, 7, 29); // 29/08/2026
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    expect(to.getMonth()).toBe(6);   // julho
    expect(to.getDate()).toBe(31);
    expect(to.getTime()).toBeLessThan(today.getTime());
  });

  it('a janela cobre exatamente os meses pedidos', () => {
    const today = new Date(2026, 7, 29);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    const months = 14;
    const from = new Date(to.getFullYear(), to.getMonth() - months + 1, 1);
    // de 01/06/2025 a 31/07/2026 = 14 meses
    expect(from.getFullYear()).toBe(2025);
    expect(from.getMonth()).toBe(5); // junho
  });
});
