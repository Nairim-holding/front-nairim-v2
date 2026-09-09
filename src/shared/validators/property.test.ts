import { describe, expect, it } from 'vitest';
import { createUnifiedPropertySchema, parseUnifiedPropertyUpdate } from './property';

const property = { title: 'Imóvel de teste', bedrooms: 0, bathrooms: 0, area_total: 100, furnished: false,
  tax_registration: '123', owner_id: 'owner', type_id: 'type', values: { status: 'AVAILABLE' } };
const legacy = { id: 'iptu-2026', year: 2026, payment_condition: 'IN_FULL_15_DISCOUNT', property_tax_cash: 3821.68, property_tax_cash_due_date: null };
describe('property update with legacy IPTU', () => {
  it('allows changing occupancy without inventing a date for unchanged legacy IPTU', () => {
    const result = parseUnifiedPropertyUpdate({ ...property, iptus: [{ ...legacy, year: '2026', property_tax_cash_due_date: '' }] }, [legacy]);
    expect(result.values?.status).toBe('AVAILABLE');
    expect(result.iptus[0].property_tax_cash_due_date).toBe('');
  });
  it('still rejects incomplete new IPTU and changes to an incomplete legacy record', () => {
    expect(() => parseUnifiedPropertyUpdate({ ...property, iptus: [legacy] }, [])).toThrow('vencimento');
    expect(() => parseUnifiedPropertyUpdate({ ...property, iptus: [{ ...legacy, property_tax_cash: 5000 }] }, [legacy])).toThrow('vencimento');
    expect(createUnifiedPropertySchema.safeParse({ ...property, iptus: [legacy] }).success).toBe(false);
  });
  it('does not bypass validation using an ID belonging to another property', () => {
    expect(() => parseUnifiedPropertyUpdate({ ...property, iptus: [{ ...legacy, id: 'foreign' }] }, [legacy])).toThrow();
  });
  it('accepts fixing the legacy date', () => {
    const result = parseUnifiedPropertyUpdate({ ...property, iptus: [{ ...legacy, property_tax_cash_due_date: '2026-01-20' }] }, [legacy]);
    expect(result.iptus[0].property_tax_cash_due_date).toBe('2026-01-20');
  });
});
