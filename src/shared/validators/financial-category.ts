import { z } from 'zod';

/**
 * Schemas Zod do módulo Categoria Financeira — substituem
 * `lib/validators/category.ts`.
 *
 * Fidelidade: nome obrigatório no create; no update só valida os campos
 * presentes; `type` deve ser INCOME/EXPENSE; `dfc_group` (quando presente e não
 * nulo) deve ser um dos valores de DFC_GROUPS. Query de listagem: limit
 * 1..100, page ≥ 1 (padrão do fluxo financeiro).
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/category.ts.
 */

export const DFC_GROUPS = ['TAXES', 'VARIABLE_EXPENSE', 'FIXED_EXPENSE', 'PAYROLL'] as const;

const dfcGroupRefine = (value: unknown) =>
  value == null || DFC_GROUPS.includes(value as (typeof DFC_GROUPS)[number]);

export const createFinancialCategorySchema = z.object({
  name: z.string().trim().min(1, 'Nome da categoria é obrigatório'),
  type: z.enum(['INCOME', 'EXPENSE'], { message: 'Tipo de categoria inválido. Deve ser INCOME ou EXPENSE' }),
  is_active: z.boolean().optional(),
  dfc_group: z
    .enum(DFC_GROUPS, { message: 'dfc_group deve ser um dos valores: TAXES, VARIABLE_EXPENSE, FIXED_EXPENSE, PAYROLL' })
    .nullable()
    .optional(),
});

export const updateFinancialCategorySchema = z.object({
  name: z.string().trim().min(1, 'O nome da categoria não pode ser vazio').optional(),
  type: z.enum(['INCOME', 'EXPENSE'], { message: 'Tipo de categoria inválido. Deve ser INCOME ou EXPENSE' }).optional(),
  is_active: z.boolean().optional(),
  dfc_group: z
    .enum(DFC_GROUPS, { message: 'dfc_group deve ser um dos valores: TAXES, VARIABLE_EXPENSE, FIXED_EXPENSE, PAYROLL' })
    .nullable()
    .optional(),
});

export const listFinancialCategoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});

export const quickCreateFinancialCategorySchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  type: z.enum(['INCOME', 'EXPENSE'], { message: 'Tipo inválido' }),
});