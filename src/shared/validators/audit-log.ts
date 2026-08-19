import { z } from 'zod';

/**
 * Validação do módulo Auditoria (Logs) — porte de `lib/validators/audit-log.ts`.
 *
 * ⚠️ Achado em teste E2E (2026-08-13): `AuditLogValidator.validateQueryParams`
 * existe no Express original mas `AuditLogController.getAuditLogs` NUNCA o
 * chama (confirmado lendo `routes/audit-log.ts` + o controller) — o teto de
 * 100 nunca foi imposto de verdade em produção, é código morto no backend.
 * Mantido aqui mesmo assim como salvaguarda sensata contra queries gigantes;
 * ajustar o `defaultLimit` do consumidor (`AuditoriaTable.tsx`) se precisar
 * de mais de 100 por página, não remover este teto sem decisão explícita.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/audit-log.ts.
 */

const VALID_ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'DELETE'] as const;

export const listAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1, 'Limit deve ser um número entre 1 e 150').max(150, 'Limit deve ser um número entre 1 e 150').optional(),
  page: z.coerce.number().int().min(1, 'Page deve ser um número positivo').optional(),
  search: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sortOptions: z.record(z.string(), z.string()).optional(),
});

/** Valida o valor de `action` quando presente num filtro — mesma regra do `AuditLogValidator` original. */
export function isValidAuditAction(value: string): boolean {
  return (VALID_ACTIONS as readonly string[]).includes(value.toUpperCase());
}
