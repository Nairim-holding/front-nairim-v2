import { z } from 'zod';

/**
 * Validação do módulo Auditoria de IPTU.
 * Camada: shared. Origem: api-nairim-v2/src/controllers/AuditController.ts
 * (sem validador dedicado no backend — checagem inline no controller).
 */

export const iptuAuditSettingsSchema = z.object({
  income_category_id: z.string().nullish(),
  income_subcategory_id: z.string().nullish(),
  expense_category_id: z.string().nullish(),
  expense_subcategory_id: z.string().nullish(),
});

export const iptuAuditQuerySchema = z.object({
  startDate: z.string().min(1, 'startDate e endDate são obrigatórios'),
  endDate: z.string().min(1, 'startDate e endDate são obrigatórios'),
});
