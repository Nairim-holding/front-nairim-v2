import { z } from 'zod';
import { isValidCPF, isValidCNPJ, emailContactSchema, contactChannelSchema } from './br-documents';

/**
 * Schemas Zod do módulo Tenants — substituem `lib/validators/tenant.ts`.
 *
 * Regras preservadas (create):
 *  - name/internal_code obrigatórios.
 *  - exige CPF (PF) OU CNPJ (PJ).
 *  - PF: occupation/marital_status obrigatórios; CPF válido; rg ≤20 chars;
 *    nationality ≤100 chars.
 *  - PJ: CNPJ válido.
 *  - endereços: zip_code/street/number obrigatórios.
 *
 * ⚠️ Ao contrário de Owner, aqui PF e PJ NÃO são mutuamente exclusivos no
 * schema (o backend permite CPF+CNPJ preenchidos simultaneamente) — fiel ao
 * TenantValidator original.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/tenant.ts.
 */

const tenantContactSchema = z.object({
  contact: z.string().nullish(),
  phone: z.string().nullish(),
  cellphone: z.string().nullish(),
  email: emailContactSchema,
  channels: z.array(contactChannelSchema).optional(),
});

const tenantAddressSchema = z.object({
  zip_code: z.string().trim().min(1, 'CEP é obrigatório'),
  street: z.string().trim().min(1, 'Rua é obrigatória'),
  number: z.string().trim().min(1, 'Número é obrigatório'),
  complement: z.string().nullish(),
  district: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  country: z.string().nullish(),
});

export const createTenantSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome é obrigatório'),
    internal_code: z.string().trim().min(1, 'Código interno é obrigatório'),
    nationality: z.string().max(100, 'Nacionalidade deve ter no máximo 100 caracteres').nullish(),
    occupation: z.string().nullish(),
    marital_status: z.string().nullish(),
    cpf: z.string().nullish(),
    rg: z.string().max(20, 'RG deve ter no máximo 20 caracteres').nullish(),
    rg_issuing_body: z.string().nullish(),
    rg_issuing_state: z.string().nullish(),
    cnpj: z.string().nullish(),
    state_registration: z.string().nullish(),
    municipal_registration: z.string().nullish(),
    contacts: z.array(tenantContactSchema).optional(),
    addresses: z.array(tenantAddressSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const isPF = !!data.cpf;
    const isPJ = !!data.cnpj;

    if (!isPF && !isPJ) {
      ctx.addIssue({ code: 'custom', message: 'É necessário informar CPF (Pessoa Física) ou CNPJ (Pessoa Jurídica)', path: [] });
    }
    if (isPF) {
      if (!data.occupation?.trim()) ctx.addIssue({ code: 'custom', message: 'Profissão é obrigatória', path: ['occupation'] });
      if (!data.marital_status?.trim()) ctx.addIssue({ code: 'custom', message: 'Estado civil é obrigatório', path: ['marital_status'] });
      if (data.cpf && !isValidCPF(data.cpf)) ctx.addIssue({ code: 'custom', message: 'CPF inválido', path: ['cpf'] });
    }
    if (isPJ && data.cnpj && !isValidCNPJ(data.cnpj)) {
      ctx.addIssue({ code: 'custom', message: 'CNPJ inválido', path: ['cnpj'] });
    }
  });

export const updateTenantSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').optional(),
  internal_code: z.string().trim().min(1, 'Código interno é obrigatório').optional(),
  nationality: z.string().max(100, 'Nacionalidade deve ter no máximo 100 caracteres').nullish(),
  occupation: z.string().nullish(),
  marital_status: z.string().nullish(),
  cpf: z.string().nullish().refine((v) => !v || isValidCPF(v), 'CPF inválido'),
  rg: z.string().max(20, 'RG deve ter no máximo 20 caracteres').nullish(),
  rg_issuing_body: z.string().nullish(),
  rg_issuing_state: z.string().nullish(),
  cnpj: z.string().nullish().refine((v) => !v || isValidCNPJ(v), 'CNPJ inválido'),
  state_registration: z.string().nullish(),
  municipal_registration: z.string().nullish(),
  contacts: z.array(tenantContactSchema).optional(),
  addresses: z.array(tenantAddressSchema).optional(),
});

export const listTenantsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(150),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});
