import { z } from 'zod';
import { isValidIsoDateString } from '@/shared/utils/date-utils';
import { ROI_LINE_KEYS } from '@/core/entities/property-roi';

/**
 * Validação do módulo ROI por imóvel.
 * Camada: shared.
 */

const lineSchema = z.object({
  category_id: z.string().nullish(),
  subcategory_id: z.string().nullish(),
});

export const roiSettingsSchema = z.object({
  lines: z.object(Object.fromEntries(ROI_LINE_KEYS.map((key) => [key, lineSchema.optional()]))),
});

export const roiReportQuerySchema = z
  .object({
    from: z.string().refine(isValidIsoDateString, 'Informe uma data inicial válida'),
    to: z.string().refine(isValidIsoDateString, 'Informe uma data final válida'),
    /** Filtro de imóveis da tela — ausente/vazio significa "todos". */
    propertyIds: z
      .union([z.array(z.string()), z.string()])
      .optional()
      .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))
      .pipe(z.array(z.string().trim().min(1)).optional()),
  })
  .refine((value) => value.from <= value.to, {
    message: 'A data inicial não pode ser maior que a data final',
    path: ['from'],
  });
