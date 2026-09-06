import { z } from 'zod';

export const createHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.'),
  description: z.string().trim().min(1, 'Informe a descrição do feriado.'),
  scope: z.enum(['NATIONAL', 'MUNICIPAL']),
  city: z.string().trim().nullish(),
}).superRefine((value, context) => {
  if (value.scope === 'MUNICIPAL' && !value.city) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['city'], message: 'Informe a cidade do feriado municipal.' });
  }
});

export const listHolidaysSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
});
