import { z } from 'zod';
import { isValidIsoDateString } from '@/shared/utils/date-utils';

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

export const iptuAuditQuerySchema = z
  .object({
    startDate: z.string().refine(isValidIsoDateString, 'Informe uma data inicial válida'),
    endDate: z.string().refine(isValidIsoDateString, 'Informe uma data final válida'),
    /** Filtro de imóveis da tela — ausente/vazio significa "todos". */
    propertyIds: z
      .union([z.array(z.string()), z.string()])
      .optional()
      .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))
      .pipe(z.array(z.string().trim().min(1)).optional()),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: 'A data inicial não pode ser maior que a data final',
    path: ['startDate'],
  });
