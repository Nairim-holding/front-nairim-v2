import { describe, expect, it } from 'vitest';
import { createFinancialInstitutionSchema, updateFinancialInstitutionSchema } from './financial-institution';
import { actionFail, describeActionError } from '@/shared/actions/action-result';

describe.each([
  ['cadastro', createFinancialInstitutionSchema],
  ['edicao', updateFinancialInstitutionSchema],
] as const)('limites bancarios no %s', (_name, schema) => {
  it('aceita os dados corrigidos sem alterar zeros ou digitos verificadores', () => {
    const data = { name: 'Sicredi', bank_number: '0748', agency_number: '3022', account_number: '5856-2', is_active: true };
    expect(schema.parse(data)).toEqual(data);
  });
  it('rejeita o texto da captura com mensagem util antes de consultar o banco', () => {
    const parsed = schema.safeParse({ name: 'Sicredi', bank_number: '0748 - Cooperativo Sicredi' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const failure = actionFail(parsed.error);
      expect(failure.status).toBe(400);
      expect(describeActionError(failure)).toContain('Informe o código');
    }
  });
  it.each([['bank_number', 20], ['agency_number', 20], ['account_number', 50]] as const)('respeita o limite de %s sem truncar', (field, limit) => {
    expect(schema.safeParse({ name: 'Teste', [field]: '1'.repeat(limit) }).success).toBe(true);
    expect(schema.safeParse({ name: 'Teste', [field]: '1'.repeat(limit + 1) }).success).toBe(false);
  });
  it('preserva campos opcionais nulos', () => {
    expect(schema.parse({ name: 'Teste', bank_number: null, agency_number: null, account_number: null })).toEqual({ name: 'Teste', bank_number: null, agency_number: null, account_number: null });
  });
});
