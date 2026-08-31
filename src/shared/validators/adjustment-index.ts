import { z } from 'zod';

/**
 * Validadores dos Índices de Reajuste (Etapa 4).
 * Camada: shared (usado pelas Server Actions).
 */

const nullableSgsCode = z
  .union([z.coerce.number().int().positive(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value));

export const createAdjustmentIndexSchema = z.object({
  code: z.string().trim().min(1, 'A sigla do indexador é obrigatória.').max(20),
  description: z.string().trim().min(1, 'A descrição é obrigatória.').max(200),
  sgs_code: nullableSgsCode,
  sgs_code_12m: nullableSgsCode,
  is_active: z.union([z.boolean(), z.string()]).optional().transform((v) => v === undefined ? undefined : v === true || v === 'true'),
});

export const updateAdjustmentIndexSchema = createAdjustmentIndexSchema.partial();

export const listAdjustmentIndexesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(30),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

/** Percentual aceita vírgula decimal, como o usuário digita. */
const percent = z.preprocess((value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace('%', '').replace(',', '.').trim());
    return Number.isNaN(parsed) ? NaN : parsed;
  }
  return NaN;
}, z.number({ message: 'Percentual inválido.' }));

export const upsertAdjustmentIndexValueSchema = z.object({
  adjustment_index_id: z.string().trim().min(1, 'O indexador é obrigatório.'),
  reference_month: z.coerce.number().int().min(1, 'Mês inválido.').max(12, 'Mês inválido.'),
  reference_year: z.coerce.number().int().min(1990, 'Ano inválido.').max(2200, 'Ano inválido.'),
  monthly_rate: percent,
  accumulated_12m: z
    .union([percent, z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value)),
});

export const syncAdjustmentIndexesSchema = z.object({
  months: z.coerce.number().int().min(1).max(120).optional(),
});
