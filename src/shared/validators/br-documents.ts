import { z } from 'zod';

/**
 * Validação de CPF/CNPJ com dígito verificador — porte exato do algoritmo do
 * backend (idêntico em OwnerValidator e TenantValidator).
 *
 * Camada: shared. Compartilhado entre os módulos Owner, Tenant e outros que
 * usem PF/PJ.
 * Origem: api-nairim-v2/src/lib/validators/{owner,tenant}.ts → validateCPF/validateCNPJ.
 */

export function isValidCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  for (let i = 1; i <= 9; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

export function isValidCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  const digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size += 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

export const cpfSchema = z.string().refine(isValidCPF, 'CPF inválido');
export const cnpjSchema = z.string().refine(isValidCNPJ, 'CNPJ inválido');
export const emailContactSchema = z.string().email('Email inválido').nullish().or(z.literal(''));

/**
 * Telefones/e-mails extras de um contato (Etapa 3).
 *
 * Precisa estar declarado no schema de contato de proprietário, inquilino,
 * imobiliária e fornecedor: o Zod descarta chave desconhecida no `.parse()`,
 * então sem isto os canais chegam do formulário e são apagados antes de
 * alcançar o repositório — o contato salva só com o número principal.
 */
export const contactChannelSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(['CELLPHONE', 'PHONE', 'EMAIL']),
  value: z.string(),
  label: z.string().nullish(),
  display_order: z.number().optional(),
});
