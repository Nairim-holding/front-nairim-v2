import { z } from 'zod';
import { isValidIsoDateString } from '@/shared/utils/date-utils';

const money = z.preprocess((value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[R$\s]/g, '');
    const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
    return Number(normalized);
  }
  return value;
}, z.number().positive('Informe um valor de crédito maior que zero.'));

export const creditReconciliationSearchSchema = z.object({
  credit_date: z.string().refine(isValidIsoDateString, 'Informe uma data de crédito válida.').refine((date) => Number(date.slice(0, 4)) >= 2000 && Number(date.slice(0, 4)) <= 2200, 'Informe um ano entre 2000 e 2200.'),
  credited_amount: money,
  financial_institution_id: z.string().trim().min(1, 'Selecione a instituição financeira.'),
  agency_ids: z.array(z.string().trim().min(1)).min(1, 'Selecione ao menos uma imobiliária.'),
});

export const completeCreditReconciliationSchema = creditReconciliationSearchSchema.extend({
  lease_id: z.string().trim().min(1, 'Selecione uma locação.'),
});
