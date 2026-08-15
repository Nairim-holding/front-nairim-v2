import { z } from 'zod';

/**
 * Schemas Zod do módulo Centro de Custo — substituem
 * `lib/validators/center.ts` (CenterValidator).
 *
 * Fidelidade: nome e `type` (INCOME|EXPENSE) obrigatórios no create; no update
 * só valida campos presentes. Query de listagem: limit 1..100, page ≥ 1.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/center.ts.
 */

const centerTypeSchema = z.enum(['INCOME', 'EXPENSE']);

export const createFinancialCenterSchema = z.object({
  name: z.string().trim().min(1, 'Nome do centro é obrigatório'),
  type: centerTypeSchema,
  is_active: z.boolean().optional(),
});

export const updateFinancialCenterSchema = z.object({
  name: z.string().trim().min(1, 'O nome do centro não pode ser vazio').optional(),
  type: centerTypeSchema.optional(),
  is_active: z.boolean().optional(),
});

export const listFinancialCentersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});

export const quickCreateFinancialCenterSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  type: centerTypeSchema,
});