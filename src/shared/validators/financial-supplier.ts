import { z } from 'zod';
import { contactChannelSchema } from './br-documents';

/**
 * Schemas Zod do módulo Fornecedor — substituem
 * `lib/validators/supplier.ts` (SupplierValidator).
 *
 * Fidelidade: `legal_name` obrigatório no create; CNPJ (14 dígitos) e CPF
 * (11 dígitos) validados quando presentes; no update valida apenas campos
 * presentes. Query de listagem: limit 1..100, page ≥ 1.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/supplier.ts.
 */

const nullableString = z.union([z.string(), z.null()]).optional();

const cnpjRefine = (v?: string | null) => v == null || v.replace(/[^\d]/g, '').length === 14;
const cpfRefine = (v?: string | null) => v == null || v.replace(/[^\d]/g, '').length === 11;

const documentSchema = (digits: number, message: string) =>
  nullableString.refine((v) => v == null || v.replace(/[^\d]/g, '').length === digits, message);

const addressSchema = z.object({
  zip_code: z.string().optional().default(''),
  street: z.string().optional().default(''),
  number: z.string().optional().default(''),
  complement: nullableString.optional(),
  district: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  country: nullableString.optional(),
  block: nullableString.optional(),
  lot: nullableString.optional(),
});

const contactSchema = z.object({
  contact: nullableString.optional(),
  phone: nullableString.optional(),
  cellphone: nullableString.optional(),
  email: nullableString.optional(),
  channels: z.array(contactChannelSchema).optional(),
});

export const createFinancialSupplierSchema = z.object({
  legal_name: z.string().trim().min(1, 'O Nome / Razão Social é obrigatório'),
  trade_name: nullableString.optional(),
  cnpj: documentSchema(14, 'CNPJ inválido. Deve conter 14 dígitos.'),
  cpf: documentSchema(11, 'CPF inválido. Deve conter 11 dígitos.'),
  internal_code: nullableString.optional(),
  occupation: nullableString.optional(),
  marital_status: nullableString.optional(),
  state_registration: nullableString.optional(),
  municipal_registration: nullableString.optional(),
  addresses: z.array(addressSchema).optional(),
  contacts: z.array(contactSchema).optional(),
});

export const updateFinancialSupplierSchema = createFinancialSupplierSchema.partial();

export const listFinancialSuppliersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(150),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});

export const quickCreateFinancialSupplierSchema = z.object({
  legal_name: z.string().trim().min(1, 'legal_name é obrigatório e deve ser uma string'),
});