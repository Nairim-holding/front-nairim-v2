import { describe, expect, it } from 'vitest';
import { creditDateError, dateDisplay, dateValue, editDate } from './date-edit';
import { createHolidaySchema } from '@/shared/validators/holiday';
import { creditReconciliationSearchSchema } from '@/shared/validators/credit-reconciliation';

describe('edição de datas', () => {
  it('preserva mês, ano e cursor ao apagar e repor o dia', () => {
    expect(editDate('0/07/2026', 1)).toEqual({ text: '0/07/2026', caret: 1 });
    expect(editDate('09/07/2026', 2)).toEqual({ text: '09/07/2026', caret: 2 });
    expect(editDate('09/0/2026', 4)).toEqual({ text: '09/0/2026', caret: 4 });
  });
  it('aceita digitação contínua e datas coladas', () => {
    expect(editDate('09072026', 8)).toEqual({ text: '09/07/2026', caret: 10 });
    expect(editDate('09/072', 6)).toEqual({ text: '09/07/2', caret: 7 });
    expect(dateDisplay('2026-07-09')).toBe('09/07/2026');
    expect(dateValue('09/07/2026')).toBe('2026-07-09');
    expect(dateValue('09/07/2')).toBe('09/07/2');
    expect(dateValue('')).toBe('');
  });
  it('rejeita datas inexistentes e informa o limite de ano', () => {
    expect(creditDateError('2026-02-31')).toBe('Informe uma data válida.');
    expect(creditDateError('1999-01-01')).toContain('2000');
    expect(creditDateError('2024-02-29')).toBe('');
    expect(creditReconciliationSearchSchema.safeParse({ credit_date: '2026-02-31', credited_amount: 1, financial_institution_id: 'bank', agency_ids: ['agency'] }).success).toBe(false);
  });
  it('exige UF para feriado estadual e cidade para municipal', () => {
    const holiday = { date: '2026-07-09', description: 'Revolução', scope: 'STATE' };
    expect(createHolidaySchema.safeParse(holiday).success).toBe(false);
    expect(createHolidaySchema.safeParse({ ...holiday, state: 'SP' }).success).toBe(true);
    expect(createHolidaySchema.safeParse({ ...holiday, scope: 'MUNICIPAL', state: 'SP' }).success).toBe(false);
    expect(createHolidaySchema.safeParse({ ...holiday, date: '2026-02-31', state: 'SP' }).success).toBe(false);
  });
});
