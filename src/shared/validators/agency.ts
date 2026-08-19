import { z } from 'zod';

/**
 * Schemas Zod do módulo Agencies — substituem `lib/validators/agency.ts`.
 *
 * Regras preservadas:
 *  - create: trade_name/legal_name/cnpj obrigatórios; CNPJ com 14 dígitos;
 *    e-mails de contato válidos.
 *  - update: mesmos formatos, opcionais.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/agency.ts.
 */

/** CNPJ: exatamente 14 dígitos após remover não-dígitos. */
const cnpjSchema = z.string().refine((v) => v.replace(/[^\d]/g, '').length === 14, 'CNPJ inválido');

const contactSchema = z.object({
  contact: z.string().nullish(),
  phone: z.string().nullish(),
  cellphone: z.string().nullish(),
  email: z.string().email('Email inválido').nullish().or(z.literal('')),
});

const addressSchema = z.object({
  zip_code: z.string().nullish(),
  street: z.string().nullish(),
  number: z.string().nullish(),
  district: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  country: z.string().nullish(),
});

export const createAgencySchema = z.object({
  trade_name: z.string().trim().min(1, 'Nome fantasia é obrigatório'),
  legal_name: z.string().trim().min(1, 'Razão social é obrigatória'),
  cnpj: z.string().trim().min(1, 'CNPJ é obrigatório').pipe(cnpjSchema),
  state_registration: z.string().nullish(),
  municipal_registration: z.string().nullish(),
  license_number: z.string().nullish(),
  commission_category_id: z.string().nullish(),
  commission_subcategory_id: z.string().nullish(),
  contacts: z.array(contactSchema).optional(),
  addresses: z.array(addressSchema).optional(),
}).passthrough();

export const updateAgencySchema = z.object({
  trade_name: z.string().trim().min(1).optional(),
  legal_name: z.string().trim().min(1).optional(),
  cnpj: cnpjSchema.optional(),
  state_registration: z.string().nullish(),
  municipal_registration: z.string().nullish(),
  license_number: z.string().nullish(),
  commission_category_id: z.string().nullish(),
  commission_subcategory_id: z.string().nullish(),
  contacts: z.array(contactSchema).optional(),
  addresses: z.array(addressSchema).optional(),
}).passthrough();

/** Parâmetros de listagem (limit 1..100, page ≥ 1). */
export const listAgenciesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(150),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});
