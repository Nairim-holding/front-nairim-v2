import { describe, expect, it } from 'vitest';
import {
  amountMatches,
  addBusinessDays,
  computeLeaseNetAmount,
  dueDatesSettledOn,
  dueDaysSettledOn,
  isBusinessDay,
  nextBusinessDay,
  holidaysForCity,
  sortCandidates,
  type CreditCandidate,
} from '@/core/entities/credit-reconciliation';

/**
 * Os dois cenários de `dueDaysSettledOn` são os exemplos que o cliente mandou
 * junto da especificação (doc "Prompts de Implementação", Etapa 7). São o
 * critério de aceite da inteligência de dias úteis.
 */

const noHolidays: { date: Date }[] = [];
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('dias úteis', () => {
  it('reconhece fim de semana como não útil', () => {
    // 20/06/2026 é sábado, 21 é domingo, 22 é segunda.
    expect(isBusinessDay(d(2026, 6, 20), noHolidays)).toBe(false);
    expect(isBusinessDay(d(2026, 6, 21), noHolidays)).toBe(false);
    expect(isBusinessDay(d(2026, 6, 22), noHolidays)).toBe(true);
  });

  it('trata feriado cadastrado como não útil', () => {
    const holidays = [{ date: d(2026, 10, 12) }];
    expect(isBusinessDay(d(2026, 10, 12), holidays)).toBe(false);
    expect(isBusinessDay(d(2026, 10, 12), noHolidays)).toBe(true);
  });

  it('empurra para o próximo dia útil', () => {
    // Sábado 20/06 → segunda 22/06.
    expect(nextBusinessDay(d(2026, 6, 20), noHolidays).getDate()).toBe(22);
    // Já sendo dia útil, devolve a própria data.
    expect(nextBusinessDay(d(2026, 6, 22), noHolidays).getDate()).toBe(22);
  });

  it('cobra um dia útil depois do repasse esperado, pulando fim de semana', () => {
    // Vencimento sexta 19/06; um dia útil depois é segunda 22/06.
    expect(addBusinessDays(d(2026, 6, 19), 1, noHolidays).getDate()).toBe(22);
  });

  it('pula também o feriado cadastrado ao contar o primeiro dia de cobrança', () => {
    const holidays = [{ date: d(2026, 10, 12) }];
    // Sexta 09/10; segunda é feriado, então a cobrança começa terça 13/10.
    expect(addBusinessDays(d(2026, 10, 9), 1, holidays).getDate()).toBe(13);
  });

  it('aplica feriado municipal somente ao município do imóvel', () => {
    const registered = [{ date: new Date(Date.UTC(2026, 5, 24)), scope: 'MUNICIPAL', city: 'São João del-Rei' }];
    expect(holidaysForCity(registered, 'Sao Joao del-Rei', [2026]).some((h) => h.date.getMonth() === 5 && h.date.getDate() === 24)).toBe(true);
    expect(holidaysForCity(registered, 'Belo Horizonte', [2026]).some((h) => h.date.getMonth() === 5 && h.date.getDate() === 24)).toBe(false);
  });
});

describe('vencimentos liquidados na data do crédito', () => {
  it('crédito na segunda recolhe o fim de semana anterior (exemplo 22/06/2026)', () => {
    expect(dueDaysSettledOn(d(2026, 6, 22), noHolidays)).toEqual([20, 21, 22]);
  });

  it('crédito na terça após feriado na segunda recolhe de sábado a terça (exemplo 13/10/2026)', () => {
    // 12/10/2026 (Nossa Senhora Aparecida) cai numa segunda-feira.
    const holidays = [{ date: d(2026, 10, 12) }];
    expect(dueDaysSettledOn(d(2026, 10, 13), holidays)).toEqual([10, 11, 12, 13]);
  });

  it('crédito num dia útil comum liquida só o próprio dia', () => {
    // Quarta-feira 24/06/2026, com terça útil antes.
    expect(dueDaysSettledOn(d(2026, 6, 24), noHolidays)).toEqual([24]);
  });

  it('não liquida nada quando a data do crédito não é dia útil', () => {
    expect(dueDaysSettledOn(d(2026, 6, 20), noHolidays)).toEqual([]);
  });

  it('preserva mês e ano ao recuar no começo do mês', () => {
    // 31/12/2022 é sábado e 01/01/2023 é domingo; ambos liquidam em 02/01.
    const dates = dueDatesSettledOn(d(2023, 1, 2), noHolidays);
    expect(dates.map((date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()])).toEqual([
      [2022, 12, 31],
      [2023, 1, 1],
      [2023, 1, 2],
    ]);
  });
});

describe('valor líquido da locação', () => {
  it('aplica Líquido = Bruto + IPTU − IRRF − Comissão', () => {
    expect(
      computeLeaseNetAmount({
        gross_amount: 3000,
        property_tax_refund: 200,
        income_tax_withheld: 150,
        agency_commission: 300,
      }),
    ).toBe(2750);
  });

  it('trata componentes ausentes como zero', () => {
    expect(computeLeaseNetAmount({ gross_amount: 1500 })).toBe(1500);
  });

  it('tolera diferença de centavos na comparação', () => {
    expect(amountMatches(2750, 2750.01)).toBe(true);
    expect(amountMatches(2750, 2751)).toBe(false);
  });
});

describe('ordenação dos candidatos', () => {
  it('coloca quem bate no valor à frente', () => {
    const base = {
      rent_due_day: 10,
      tax_due_day: null,
      condo_due_day: null,
      net_amount: 0,
      gross_amount: 0,
      property_tax_refund: 0,
      income_tax_withheld: 0,
      agency_commission: 0,
      rent_due_date: '2026-06-10',
      pending_transaction_ids: [],
    };
    const candidates: CreditCandidate[] = [
      { ...base, lease_id: 'a', property_title: 'Imóvel A', tenant_name: 'X', agency_name: 'Alfa', amount_matches: false },
      { ...base, lease_id: 'b', property_title: 'Imóvel B', tenant_name: 'Y', agency_name: 'Beta', amount_matches: true },
    ];
    expect(sortCandidates(candidates).map((c) => c.lease_id)).toEqual(['b', 'a']);
  });
});
