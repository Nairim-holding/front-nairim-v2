import 'server-only';
import { auditLogUseCases } from '@/infra/factories/audit-log-factory';
import { withPermission } from '@/infra/auth/session';
import { listAuditLogsQuerySchema } from '@/shared/validators/audit-log';
import type { AuditFiltersResponse, AuditLogDetail, PaginatedAuditLogs } from '@/core/entities/audit-log';

/**
 * Queries (leitura) do módulo Auditoria (Logs) — para Server Components.
 * Guarda: `withPermission('audit-logs', 'view')`. Camada: server.
 * Origem: AuditLogController.ts (GETs) — recurso read-only.
 */

/** Mesmo parsing de `sort[x]`/`filter[x]` usado pelos demais módulos (ex: lease.ts). */
function splitListParams(raw: Record<string, unknown>) {
  const sortOptions: Record<string, string> = {};
  const filters: Record<string, unknown> = {};

  Object.entries(raw ?? {}).forEach(([key, value]) => {
    if (typeof value !== 'string') return;
    const sortMatch = key.match(/^sort\[(.+)\]$/);
    if (sortMatch) {
      const dir = value.toLowerCase();
      if (dir === 'asc' || dir === 'desc') sortOptions[sortMatch[1]] = dir;
      return;
    }
    if (['limit', 'page', 'search'].includes(key) || value.trim() === '') return;

    const filterMatch = key.match(/^filter\[(.+)\]$/);
    const filterKey = filterMatch ? filterMatch[1] : key;
    if (key !== 'sort' && !key.startsWith('sort[')) {
      try {
        filters[filterKey] = JSON.parse(value);
      } catch {
        filters[filterKey] = value;
      }
    }
  });

  return { sortOptions, filters };
}

export async function listAuditLogsData(raw: Record<string, unknown>): Promise<PaginatedAuditLogs> {
  const { limit, page, search } = listAuditLogsQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withPermission('audit-logs', 'view', () =>
    auditLogUseCases.list.execute({ limit, page, search, sortOptions, filters }),
  );
}

export async function getAuditLogByIdData(id: string): Promise<AuditLogDetail> {
  return withPermission('audit-logs', 'view', () => auditLogUseCases.getById.execute(id));
}

export async function getAuditLogFiltersData(raw: Record<string, unknown>): Promise<AuditFiltersResponse> {
  const { filters } = splitListParams(raw);
  return withPermission('audit-logs', 'view', () => auditLogUseCases.getFilters.execute(filters));
}
