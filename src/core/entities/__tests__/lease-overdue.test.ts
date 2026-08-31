import { describe, expect, it } from 'vitest';
import {
  buildNotificationMessage,
  buildWhatsAppLink,
  daysBetween,
  isOverdue,
  overdueTotal,
  severityOf,
  sortOverdueLeases,
  type OverdueLease,
} from '@/core/entities/lease-overdue';

const lease = (overrides: Partial<OverdueLease> = {}): OverdueLease => ({
  lease_id: 'l1',
  property_title: 'Imóvel A',
  tenant_name: 'Inquilino A',
  agency_name: 'Imobiliária A',
  rent_due_day: 10,
  due_date: new Date(2026, 7, 10),
  days_overdue: 5,
  amount: 1500,
  reference_month: 8,
  reference_year: 2026,
  overdue_status: null,
  agency_email: 'contato@imob.com',
  agency_phone: '(11) 3000-0000',
  last_notified_at: null,
  ...overrides,
});

describe('cálculo do atraso', () => {
  it('conta dias corridos ignorando a hora', () => {
    expect(daysBetween(new Date(2026, 7, 10, 23, 59), new Date(2026, 7, 15, 0, 1))).toBe(5);
  });

  it('não considera atrasado no próprio dia do vencimento', () => {
    expect(isOverdue(new Date(2026, 7, 10), new Date(2026, 7, 10))).toBe(false);
    expect(isOverdue(new Date(2026, 7, 10), new Date(2026, 7, 11))).toBe(true);
  });

  it('classifica a severidade pelas faixas de uso', () => {
    expect(severityOf(1)).toBe('recent');
    expect(severityOf(5)).toBe('recent');
    expect(severityOf(6)).toBe('attention');
    expect(severityOf(30)).toBe('attention');
    expect(severityOf(31)).toBe('critical');
  });
});

describe('lista de atrasadas', () => {
  it('ordena da mais atrasada para a menos', () => {
    const sorted = sortOverdueLeases([
      lease({ lease_id: 'a', days_overdue: 3 }),
      lease({ lease_id: 'b', days_overdue: 40 }),
      lease({ lease_id: 'c', days_overdue: 12 }),
    ]);
    expect(sorted.map((l) => l.lease_id)).toEqual(['b', 'c', 'a']);
  });

  it('soma os valores em atraso', () => {
    expect(overdueTotal([lease({ amount: 1500.5 }), lease({ amount: 2000.25 })])).toBe(3500.75);
  });
});

describe('mensagem de cobrança', () => {
  it('inclui imóvel, vencimento, dias e valor', () => {
    const message = buildNotificationMessage(lease());
    expect(message).toContain('Imóvel A');
    expect(message).toContain('10/08/2026');
    expect(message).toContain('5');
    expect(message).toContain('R$');
  });

  it('monta o link do WhatsApp com DDI', () => {
    const link = buildWhatsAppLink(lease({ agency_phone: '(11) 98888-7777' }));
    expect(link).toContain('https://wa.me/5511988887777');
    expect(link).toContain('?text=');
  });

  it('não duplica o DDI quando o número já tem 55', () => {
    expect(buildWhatsAppLink(lease({ agency_phone: '55 11 98888-7777' }))).toContain('wa.me/5511988887777');
  });

  it('devolve null sem telefone utilizável', () => {
    expect(buildWhatsAppLink(lease({ agency_phone: null }))).toBeNull();
    expect(buildWhatsAppLink(lease({ agency_phone: '123' }))).toBeNull();
  });
});
