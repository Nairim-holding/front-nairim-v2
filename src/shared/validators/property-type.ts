import { z } from 'zod';

/**
 * Schemas Zod do módulo Property-types — substituem `lib/validators/property-type.ts`.
 * Camada: shared. Origem: api-nairim-v2/src/lib/validators/property-type.ts.
 */

export const createPropertyTypeSchema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória').max(100, 'Descrição deve ter no máximo 100 caracteres'),
});

export const updatePropertyTypeSchema = z.object({
  description: z.string().trim().min(1, 'Descrição não pode ser vazia').max(100, 'Descrição deve ter no máximo 100 caracteres').optional(),
});

export const listPropertyTypesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});
