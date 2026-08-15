import { z } from 'zod';

/**
 * Schemas Zod do módulo Planejamento (Módulo 10).
 * Substituem as leituras de `req.body`/`req.query` do PlanningController:
 *  - `POST /planning`  (upsert)
 *  - `DELETE /planning/:id`
 *  - `GET /planning/dashboard?startDate=&endDate=&<filtros>`
 *
 * Fidelidade ao PlanningValidator:
 *  - upsert: category_id obrigatório; type FIXED|VARIABLE; FIXED exige
 *    default_amount não negativo; VARIABLE exige monthly_values não vazio com
 *    mês 1-12 único e amont não negativo.
 *  - dashboard: startDate/endDate obrigatórios no formato YYYY-MM-DD e
 *    startDate <= endDate. Filtros adicionais passam pelo `passthrough`.
 */

export const planningUpsertSchema = z
  .object({
    category_id: z.string().min(1, 'category_id é obrigatório'),
    subcategory_id: z.string().nullish(),
    type: z.enum(['FIXED', 'VARIABLE'], { errorMap: () => ({ message: 'type deve ser FIXED ou VARIABLE' }) }),
    default_amount: z.number().nullish(),
    monthly_values: z
      .array(
        z.object({
          month: z.number().int().min(1).max(12),
          amount: z.number().nonnegative(),
        }),
      )
      .nullish(),
  })
  .passthrough();

export const planningDashboardQuerySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate deve estar no formato YYYY-MM-DD'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate deve estar no formato YYYY-MM-DD'),
  })
  .passthrough();