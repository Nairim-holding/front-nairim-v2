import { z } from 'zod';
import { BRANDING_FIELDS, type BrandingData } from '@/core/entities/company';

/**
 * Validação e seleção de campos do módulo Company.
 * Camada: shared.
 * Origem: `pickBrandingFields` + validações inline do CompanyController.
 */

/**
 * Seleciona apenas os campos de branding conhecidos, descartando `undefined`,
 * strings vazias e arrays vazios — idêntico ao `pickBrandingFields` do backend.
 */
export function pickBrandingFields(body: Record<string, unknown>): BrandingData {
  const data: Record<string, unknown> = {};
  for (const field of BRANDING_FIELDS) {
    const value = body[field];
    if (value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0)) {
      data[field] = value;
    }
  }
  return data;
}

/** Slug obrigatório (troca de empresa). */
export const switchCompanySchema = z.object({
  slug: z.string().trim().min(1, '"slug" é obrigatório'),
});

/** Parâmetros de listagem de empresas. */
export const listCompaniesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(30),
  search: z.string().optional().default(''),
  // Aceita boolean real ou a string 'true' (compat com query string).
  includeInactive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;
