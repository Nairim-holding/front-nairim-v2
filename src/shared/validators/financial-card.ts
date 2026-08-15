import { z } from 'zod';

/**
 * Schemas Zod do módulo Cartão Financeiro — substituem
 * `lib/validators/card.ts` (CardValidator).
 *
 * Fidelidade: nome obrigatório no create; `limit` numérico opcional;
 * `closing_day`/`due_day` opcionais em 1..31. No update só valida campos
 * presentes. Query de listagem: limit 1..100, page ≥ 1.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/card.ts.
 */

const daySchema = z
  .union([z.literal(''), z.number(), z.string()])
  .optional()
  .transform((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    const day = Number(val);
    return Number.isInteger(day) ? day : undefined;
  })
  .pipe(z.number().int().min(1).max(31).optional());

const limitSchema = z
  .union([z.literal(''), z.number(), z.string()])
  .optional()
  .transform((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    const parsed = Number(val);
    return Number.isNaN(parsed) ? undefined : parsed;
  })
  .pipe(z.number().finite().optional());

export const createFinancialCardSchema = z.object({
  name: z.string().trim().min(1, 'O nome do cartão é obrigatório'),
  limit: limitSchema,
  closing_day: daySchema,
  due_day: daySchema,
  is_active: z.boolean().optional(),
});

export const updateFinancialCardSchema = z.object({
  name: z.string().trim().min(1, 'O nome do cartão não pode ser vazio').optional(),
  limit: limitSchema,
  closing_day: daySchema,
  due_day: daySchema,
  is_active: z.boolean().optional(),
});

export const listFinancialCardsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});

export const quickCreateFinancialCardSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
});

export const cardUsageSummarySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  category_id: z.array(z.string()).optional(),
  subcategory_id: z.array(z.string()).optional(),
  financial_institution_id: z.array(z.string()).optional(),
  card_id: z.array(z.string()).optional(),
  center_id: z.array(z.string()).optional(),
  supplier_id: z.array(z.string()).optional(),
  description: z.array(z.string()).optional(),
});