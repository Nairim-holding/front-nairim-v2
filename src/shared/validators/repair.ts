import { z } from 'zod';
import { isValidIsoDateString } from '@/shared/utils/date-utils';
const date = z.string().refine(isValidIsoDateString, 'Informe uma data válida');
const optionalDate = z.union([date, z.literal(''), z.null()]).optional().transform(v => v || null);
const money = z.coerce.number().finite().min(0, 'O valor não pode ser negativo').max(999999999999.99).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.001, 'Use até duas casas decimais');
export const repairSchema = z.object({
  property_id: z.string().uuid(), event_date: date, event_type: z.enum(['REPAIR', 'RENOVATION']),
  problem_type: z.enum(['STRUCTURAL', 'ELECTRICAL', 'HYDRAULIC', 'FINISHING']),
  description: z.string().trim().min(1, 'Detalhe o problema').max(10000),
  professional: z.string().trim().min(1, 'Informe o profissional ou empresa').max(300),
  service_amount: money, materials_amount: money,
  payment_method: z.string().trim().min(1, 'Informe a forma de pagamento').max(100),
  payment_conditions: z.string().trim().min(1, 'Informe as condições de pagamento').max(1000),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  start_date: optionalDate, completion_date: optionalDate, notes: z.string().trim().max(10000).nullable().optional(),
}).superRefine((v, ctx) => {
  if (v.start_date && v.completion_date && v.start_date > v.completion_date)
    ctx.addIssue({ code: 'custom', path: ['completion_date'], message: 'A conclusão deve ser posterior ou igual ao início' });
  if (v.status === 'COMPLETED' && !v.completion_date)
    ctx.addIssue({ code: 'custom', path: ['completion_date'], message: 'Informe a data de conclusão' });
});
export const repairListSchema = z.object({
  search: z.string().max(200).optional(), property_id: z.string().uuid().optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  from: date.optional(), to: date.optional(), page: z.coerce.number().int().min(1).default(1),
}).refine(v => !v.from || !v.to || v.from <= v.to, 'O início do período deve ser anterior ao fim');
export type RepairInput = z.infer<typeof repairSchema>;
export const REPAIR_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'];
export const REPAIR_MEDIA_MAX_BYTES = 20 * 1024 * 1024;
