import { z } from 'zod';

/**
 * Schemas Zod do módulo Instituição Financeira — substituem
 * `lib/validators/financialIntitucion.ts`.
 *
 * Fidelidade: nome obrigatório no create; no update, se presente não pode ser
 * vazio. Query de listagem: limit 1..100, page ≥ 1 (iguais ao
 * `FinancialInstitutionValidator.validateQueryParams`).
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/financialIntitucion.ts.
 */

export const createFinancialInstitutionSchema = z.object({
  name: z.string().trim().min(1, 'Nome da instituição é obrigatório'),
  bank_number: z.string().nullish(),
  agency_number: z.string().nullish(),
  account_number: z.string().nullish(),
  is_active: z.boolean().optional(),
});

export const updateFinancialInstitutionSchema = z.object({
  name: z.string().trim().min(1, 'Nome da instituição não pode ser vazio').optional(),
  bank_number: z.string().nullish(),
  agency_number: z.string().nullish(),
  account_number: z.string().nullish(),
  is_active: z.boolean().optional(),
});

export const listFinancialInstitutionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(150),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});

export const quickCreateFinancialInstitutionSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
});