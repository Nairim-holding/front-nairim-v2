import { z } from 'zod';
import { isValidCPF, isValidCNPJ, emailContactSchema } from './br-documents';

/**
 * Schemas Zod do módulo Owners — substituem `lib/validators/owner.ts`.
 *
 * Regras preservadas (create):
 *  - name/internal_code obrigatórios.
 *  - exige CPF (PF) OU CNPJ (PJ), nunca ambos nem nenhum.
 *  - PF: occupation/marital_status obrigatórios; CPF válido; cnpj/state_registration/
 *    municipal_registration não podem vir preenchidos.
 *  - PJ: CNPJ válido; cpf/occupation/marital_status não podem vir preenchidos.
 *  - endereços: zip_code/street/number obrigatórios (se houver algum endereço).
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/owner.ts.
 */

const ownerContactSchema = z.object({
  contact: z.string().nullish(),
  phone: z.string().nullish(),
  cellphone: z.string().nullish(),
  email: emailContactSchema,
});

const ownerAddressSchema = z.object({
  zip_code: z.string().trim().min(1, 'CEP é obrigatório'),
  street: z.string().trim().min(1, 'Rua é obrigatória'),
  number: z.string().trim().min(1, 'Número é obrigatório'),
  complement: z.string().nullish(),
  district: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  country: z.string().nullish(),
});

export const createOwnerSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome é obrigatório'),
    internal_code: z.string().trim().min(1, 'Código interno é obrigatório'),
    occupation: z.string().nullish(),
    marital_status: z.string().nullish(),
    cpf: z.string().nullish(),
    cnpj: z.string().nullish(),
    state_registration: z.string().nullish(),
    municipal_registration: z.string().nullish(),
    contacts: z.array(ownerContactSchema).optional(),
    addresses: z.array(ownerAddressSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const isPF = !!data.cpf;
    const isPJ = !!data.cnpj;

    if (!isPF && !isPJ) {
      ctx.addIssue({ code: 'custom', message: 'É necessário informar CPF (Pessoa Física) ou CNPJ (Pessoa Jurídica)', path: [] });
    }
    if (isPF) {
      if (!data.occupation?.trim()) ctx.addIssue({ code: 'custom', message: 'Profissão é obrigatória para Pessoa Física', path: ['occupation'] });
      if (!data.marital_status?.trim()) ctx.addIssue({ code: 'custom', message: 'Estado civil é obrigatório para Pessoa Física', path: ['marital_status'] });
      if (data.cpf && !isValidCPF(data.cpf)) ctx.addIssue({ code: 'custom', message: 'CPF inválido', path: ['cpf'] });
      if (data.cnpj) ctx.addIssue({ code: 'custom', message: 'Não é permitido informar CNPJ para Pessoa Física', path: ['cnpj'] });
      if (data.state_registration) ctx.addIssue({ code: 'custom', message: 'Inscrição Estadual não é permitida para Pessoa Física', path: ['state_registration'] });
      if (data.municipal_registration) ctx.addIssue({ code: 'custom', message: 'Inscrição Municipal não é permitida para Pessoa Física', path: ['municipal_registration'] });
    }
    if (isPJ) {
      if (data.cnpj && !isValidCNPJ(data.cnpj)) ctx.addIssue({ code: 'custom', message: 'CNPJ inválido', path: ['cnpj'] });
      if (data.cpf) ctx.addIssue({ code: 'custom', message: 'Não é permitido informar CPF para Pessoa Jurídica', path: ['cpf'] });
      if (data.occupation) ctx.addIssue({ code: 'custom', message: 'Profissão não é permitida para Pessoa Jurídica', path: ['occupation'] });
      if (data.marital_status) ctx.addIssue({ code: 'custom', message: 'Estado civil não é permitido para Pessoa Jurídica', path: ['marital_status'] });
    }
  });

/**
 * Update: campos opcionais. A validação condicional de PF/PJ (obrigatoriedade
 * cruzada) fica a cargo do use-case, que já conhece o registro existente —
 * aqui validamos apenas formato (CPF/CNPJ válidos quando informados, e-mails).
 */
export const updateOwnerSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').optional(),
  internal_code: z.string().trim().min(1, 'Código interno é obrigatório').optional(),
  occupation: z.string().nullish(),
  marital_status: z.string().nullish(),
  cpf: z.string().nullish().refine((v) => !v || isValidCPF(v), 'CPF inválido'),
  cnpj: z.string().nullish().refine((v) => !v || isValidCNPJ(v), 'CNPJ inválido'),
  state_registration: z.string().nullish(),
  municipal_registration: z.string().nullish(),
  contacts: z.array(ownerContactSchema).optional(),
  addresses: z.array(ownerAddressSchema).optional(),
});

export const listOwnersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(150),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});
