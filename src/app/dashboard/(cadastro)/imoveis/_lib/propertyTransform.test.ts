import { describe, expect, it } from 'vitest';
import { buildPropertyFormData, transformPropertyData } from './propertyTransform';
import { createUnifiedPropertySchema } from '@/shared/validators/property';

describe('property sale observation round trip', () => {
  it('keeps sale observations separate from property and financial notes through form submission and validation', () => {
    const saleNotes = 'Financiamento aprovado.\nAguardar assinatura da escritura.';
    const form = transformPropertyData({
      title: 'Casa', bedrooms: 2, bathrooms: 1, area_total: 100, furnished: false,
      tax_registration: '123', owner_id: 'owner', type_id: 'type', notes: 'Detalhes do imóvel',
      values: [{ status: 'SOLD', sale_buyer: 'Comprador', sale_value: 450000, sale_date: '2026-09-28',
        notes: 'Condições financeiras', sale_notes: saleNotes }],
    });
    expect(form.sale_notes).toBe(saleNotes);
    const fd = buildPropertyFormData(form, 'user');
    const property = JSON.parse(String(fd.get('propertyData')));
    const values = JSON.parse(String(fd.get('valuesData')));
    const parsed = createUnifiedPropertySchema.parse({ ...property, values });
    expect(parsed.values?.sale_notes).toBe(saleNotes);
    expect(parsed.notes).toBe('Detalhes do imóvel');
    expect(parsed.values?.notes).toBe('Condições financeiras');
  });

  it('opens legacy properties without observations and submits a cleared observation as null', () => {
    const form = transformPropertyData({ values: [{ status: 'AVAILABLE' }] });
    expect(form.sale_notes).toBe('');
    expect(JSON.parse(String(buildPropertyFormData(form, 'user').get('valuesData'))).sale_notes).toBeNull();
  });
});
