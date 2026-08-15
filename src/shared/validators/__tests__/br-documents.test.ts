import { describe, it, expect } from 'vitest';
import { isValidCPF, isValidCNPJ } from '@/shared/validators/br-documents';

describe('br-documents', () => {
  describe('isValidCPF', () => {
    it('aceita CPF válido', () => {
      expect(isValidCPF('529.982.247-25')).toBe(true);
    });
    it('rejeita CPF com dígitos repetidos', () => {
      expect(isValidCPF('11111111111')).toBe(false);
    });
    it('rejeita CPF com tamanho errado', () => {
      expect(isValidCPF('123')).toBe(false);
    });
    it('rejeita CPF com dígito verificador inválido', () => {
      expect(isValidCPF('52998224726')).toBe(false);
    });
  });

  describe('isValidCNPJ', () => {
    it('aceita CNPJ válido', () => {
      expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    });
    it('rejeita CNPJ com dígitos repetidos', () => {
      expect(isValidCNPJ('11111111111111')).toBe(false);
    });
    it('rejeita CNPJ com dígito verificador inválido', () => {
      expect(isValidCNPJ('11222333000182')).toBe(false);
    });
  });
});
