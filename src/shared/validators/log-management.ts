import { z } from 'zod';
import type { Filter } from 'mongodb';
import type { StoredAuditLog } from '@/infra/database/mongodb';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Data inválida');
export const logSelectionSchema = z.object({
  mode: z.enum(['older', 'range', 'all']),
  days: z.coerce.number().int().min(1).max(36500).default(90),
  from: date.optional(),
  to: date.optional(),
  action: z.enum(['LOGIN', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'DELETE']).optional(),
  user_email: z.string().email().max(254).optional(),
  table_name: z.string().trim().min(1).max(60).optional(),
}).superRefine((value, ctx) => {
  if (value.mode === 'range' && (!value.from || !value.to || value.from > value.to)) {
    ctx.addIssue({ code: 'custom', message: 'Informe um período válido, com início e fim.' });
  }
});
export type LogSelection = z.infer<typeof logSelectionSchema>;

export function buildLogSelection(companyId: string, input: unknown, now = new Date()): Filter<StoredAuditLog> {
  if (!companyId) throw new Error('Empresa obrigatória.');
  const selection = logSelectionSchema.parse(input);
  const query: Filter<StoredAuditLog> = { company_id: companyId, ingested_at: { $lte: now } };
  if (selection.mode === 'older') query.created_at = { $lt: new Date(now.getTime() - selection.days * 86400000) };
  if (selection.mode === 'range') {
    // Datas do usuário em Brasília (UTC-3), incluindo integralmente o último dia.
    const end = new Date(selection.to + 'T00:00:00-03:00');
    end.setTime(end.getTime() + 86400000);
    query.created_at = { $gte: new Date(selection.from + 'T00:00:00-03:00'), $lt: end };
  }
  if (selection.action) query.action = selection.action;
  if (selection.user_email) query.user_email = selection.user_email;
  if (selection.table_name) query.table_name = selection.table_name;
  return query;
}
