import { describe, expect, it } from 'vitest';
import { automaticHolidays, holidayWeekday } from '../holidays';
import { holidaysForCity, isBusinessDay, nextBusinessDay } from '../credit-reconciliation';

describe('calendário automático de feriados', () => {
  it('preenche os nacionais e calcula a Paixão de Cristo a cada ano', () => {
    expect(automaticHolidays(2026).find((h) => h.description === 'Paixão de Cristo')?.date).toBe('2026-04-03');
    expect(automaticHolidays(2027).find((h) => h.description === 'Paixão de Cristo')?.date).toBe('2027-03-26');
    expect(automaticHolidays(2026)).toHaveLength(10);
    expect(automaticHolidays(2023).some((h) => h.date.endsWith('11-20'))).toBe(false);
  });
  it('mostra os dias reais da semana dos exemplos, inclusive terça em 05/05/2026', () => {
    expect(holidayWeekday('2026-01-01')).toBe('Quinta-feira');
    expect(holidayWeekday('2026-04-03')).toBe('Sexta-feira');
    expect(holidayWeekday('2026-07-09')).toBe('Quinta-feira');
    expect(holidayWeekday('2026-11-20')).toBe('Sexta-feira');
    expect(holidayWeekday('2026-05-05')).toBe('Terça-feira');
  });
  it('aplica os feriados regionais somente à UF e cidade correspondentes', () => {
    expect(automaticHolidays(2026, 'sp', 'garca').filter((h) => h.scope !== 'NATIONAL')).toHaveLength(3);
    expect(automaticHolidays(2026, 'SP', 'Bauru').filter((h) => h.scope !== 'NATIONAL')).toHaveLength(1);
    expect(automaticHolidays(2026, 'MG', 'Garça').filter((h) => h.scope !== 'NATIONAL')).toHaveLength(0);
    const saved = [{ date: new Date('2026-08-11T00:00:00Z'), scope: 'STATE', state: 'MG', city: null }];
    expect(isBusinessDay(new Date(2026, 7, 11), holidaysForCity(saved, null, [2026], 'MG'))).toBe(false);
    expect(isBusinessDay(new Date(2026, 7, 11), holidaysForCity(saved, null, [2026], 'SP'))).toBe(true);
  });
  it('desloca créditos por feriado móvel e estadual sem cadastro manual', () => {
    expect(nextBusinessDay(new Date(2026, 3, 3), holidaysForCity([], null, [2026])).getDate()).toBe(6);
    expect(nextBusinessDay(new Date(2026, 6, 9), holidaysForCity([], null, [2026], 'SP')).getDate()).toBe(10);
  });
});
