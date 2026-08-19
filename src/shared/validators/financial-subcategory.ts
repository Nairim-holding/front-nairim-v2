import { z } from 'zod';

/**
 * Schemas Zod do módulo Subcategoria Financeira — substituem
 * `lib/validators/subcategory.ts`.
 *
 * Fidelidade: nome e `category_id` obrigatórios no create; no update só valida
 * os campos presentes. Query de listagem: limit 1..100, page ≥ 1.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/subcategory.ts.
 */

export const createFinancialSubcategorySchema = z.object({
  name: z.string().trim().min(1, 'Nome da subcategoria é obrigatório'),
  category_id: z.string().trim().min(1, 'O ID da categoria pai é obrigatório'),
  is_active: z.boolean().optional(),
});

export const updateFinancialSubcategorySchema = z.object({
  name: z.string().trim().min(1, 'O nome da subcategoria não pode ser vazio').optional(),
  category_id: z.string().trim().min(1, 'O ID da categoria pai não pode ser vazio').optional(),
  is_active: z.boolean().optional(),
});

export const listFinancialSubcategoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(150),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});

export const quickCreateFinancialSubcategorySchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  category_id: z.string().trim().min(1, 'Categoria pai é obrigatória'),
});