import { z } from 'zod';
import { isValidIsoDateString } from '@/shared/utils/date-utils';
import { BRAZIL_STATES } from '@/core/entities/holidays';

export const createHolidaySchema = z.object({
  date: z.string().refine(isValidIsoDateString, 'Informe uma data válida.').refine((date) => Number(date.slice(0, 4)) >= 2000 && Number(date.slice(0, 4)) <= 2200, 'Informe um ano entre 2000 e 2200.'),
  description: z.string().trim().min(1, 'Informe a descrição do feriado.'),
  scope: z.enum(['NATIONAL', 'STATE', 'MUNICIPAL']),
  state: z.union([z.enum(BRAZIL_STATES), z.literal('')]).nullish(),
  city: z.string().trim().nullish(),
}).superRefine((value, context) => {
  if (value.scope !== 'NATIONAL' && !value.state) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['state'], message: 'Informe o estado do feriado.' });
  }
  if (value.scope === 'MUNICIPAL' && !value.city) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['city'], message: 'Informe a cidade do feriado municipal.' });
  }
});

export const listHolidaysSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
});
