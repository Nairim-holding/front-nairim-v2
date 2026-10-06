import { z } from 'zod';
import { isValidIsoDateString } from '@/shared/utils/date-utils';
const date = z.string().refine(isValidIsoDateString, 'Informe uma data válida');
const optionalDate = z.union([date, z.literal(''), z.null()]).optional().transform(v => v || null);
const money = z.coerce.number().finite().min(0, 'O valor não pode ser negativo').max(999999999999.99).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.001, 'Use até duas casas decimais');
const problemType = z.enum(['STRUCTURAL', 'ELECTRICAL', 'HYDRAULIC', 'FINISHING']);
const itemFields = {
  description: z.string().trim().min(1, 'Descreva cada item').max(1000),
  kind: z.enum(['LABOR', 'MATERIAL']), amount: money,
};
const fields = {
  property_id: z.string().uuid(), event_date: date, event_type: z.enum(['REPAIR', 'RENOVATION']),
  problem_type: problemType.optional(),
  problem_types: z.array(problemType).min(1, 'Selecione pelo menos um tipo de problema').max(4).optional(),
  description: z.string().trim().min(1, 'Detalhe o problema').max(10000),
  service_amount: money, materials_amount: money,
  payment_method: z.string().trim().min(1, 'Informe a forma de pagamento').max(100),
  payment_conditions: z.string().trim().min(1, 'Informe as condições de pagamento').max(1000),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  start_date: optionalDate, completion_date: optionalDate, notes: z.string().trim().max(10000).nullable().optional(),
};
const validateDates = (v: { start_date?: string | null; completion_date?: string | null; status: string }, ctx: z.RefinementCtx) => {
  if (v.start_date && v.completion_date && v.start_date > v.completion_date)
    ctx.addIssue({ code: 'custom', path: ['completion_date'], message: 'A conclusão deve ser posterior ou igual ao início' });
  if (v.status === 'COMPLETED' && !v.completion_date)
    ctx.addIssue({ code: 'custom', path: ['completion_date'], message: 'Informe a data de conclusão' });
};
const validateProblems = (v: { problem_type?: string; problem_types?: string[] }, ctx: z.RefinementCtx) => {
  if (!v.problem_type && !v.problem_types?.length)
    ctx.addIssue({ code: 'custom', path: ['problem_types'], message: 'Selecione pelo menos um tipo de problema' });
};
// Valida os demais campos antes de criar um contato pelo cadastro rápido.
export const repairDetailsSchema = z.object({ ...fields,
  items: z.array(z.object({ ...itemFields, supplier_id: z.string().min(1, 'Selecione o responsável de cada item') })).max(200).default([]),
}).superRefine(validateDates).superRefine(validateProblems);
export const repairSchema = z.object({ ...fields,
  supplier_id: z.string().uuid('Selecione o profissional ou empresa nos Contatos do Financeiro').optional(),
  supplier_ids: z.array(z.string().uuid()).min(1, 'Selecione pelo menos um profissional').max(100).optional(),
  items: z.array(z.object({ ...itemFields, supplier_id: z.string().uuid('Selecione o responsável de cada item') })).max(200).default([]),
}).superRefine(validateDates).superRefine(validateProblems).superRefine((v, ctx) => {
  if (!v.supplier_id && !v.supplier_ids?.length)
    ctx.addIssue({ code: 'custom', path: ['supplier_ids'], message: 'Selecione pelo menos um profissional' });
  for (const kind of ['LABOR', 'MATERIAL']) {
    const total = v.items.filter(item => item.kind === kind).reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
    if (!money.safeParse(total).success) ctx.addIssue({ code: 'custom', path: ['items'], message: 'O sub-total dos itens excede o limite permitido' });
  }
}).transform(v => ({ ...v,
  problem_types: [...new Set(v.problem_types ?? [v.problem_type!])],
  supplier_ids: [...new Set(v.supplier_ids ?? [v.supplier_id!])],
}));
export const repairListSchema = z.object({
  search: z.string().max(200).optional(), property_id: z.string().uuid().optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  from: date.optional(), to: date.optional(), page: z.coerce.number().int().min(1).default(1),
}).refine(v => !v.from || !v.to || v.from <= v.to, 'O início do período deve ser anterior ao fim');
export type RepairInput = z.infer<typeof repairSchema>;
export const REPAIR_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'];
export const REPAIR_MEDIA_MAX_BYTES = 20 * 1024 * 1024;
