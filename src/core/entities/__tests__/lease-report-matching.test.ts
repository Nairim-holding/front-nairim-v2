import { describe, expect, it } from 'vitest';
import { matchReportLease, type ReportLeaseMatch } from '../lease-report-matching';

const lease: ReportLeaseMatch = {
  id: 'lease-1', contract_number: '123/25',
  start_date: new Date('2025-01-01'), end_date: new Date('2027-12-31'), canceled_at: null,
  property: { title: 'Rua América, 389' },
};
const date = new Date('2026-04-01');

describe('identificação de lançamentos avulsos da locação', () => {
  it('exige contrato completo e não tenta endereço quando o contrato diverge', () => {
    expect(matchReportLease('Aluguel Contrato 123/25', date, [lease])?.id).toBe(lease.id);
    expect(matchReportLease('Aluguel Rua América, 389 Contrato 123/250', date, [lease])).toBeUndefined();
  });

  it('aceita endereço inequívoco sem acento, mas não confunde números de imóveis', () => {
    expect(matchReportLease('Multa Rua America, 389 Receita 1/3', date, [lease])?.id).toBe(lease.id);
    expect(matchReportLease('Multa Rua America, 3890 Receita 1/3', date, [lease])).toBeUndefined();
  });

  it('não atribui por endereço a contrato fora da vigência ou ambíguo', () => {
    const description = 'Multa Rua América, 389';
    expect(matchReportLease(description, date, [lease, { ...lease, id: 'lease-2' }])).toBeUndefined();
    expect(matchReportLease(description, date, [{ ...lease, canceled_at: new Date('2026-03-31') }])).toBeUndefined();
    expect(matchReportLease(description, date, [{ ...lease, start_date: new Date('2026-05-01') }])).toBeUndefined();
  });
});
