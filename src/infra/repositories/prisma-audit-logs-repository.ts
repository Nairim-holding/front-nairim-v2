import prisma from '@/infra/database/prisma';
import type { AuditLogsRepository } from '@/core/repositories/audit-logs-repository';
import type {
  AuditFiltersResponse,
  AuditLogDetail,
  AuditLogRow,
  GetAuditLogsParams,
  PaginatedAuditLogs,
} from '@/core/entities/audit-log';
import { modelLabel, MODEL_LABELS, prettifyFieldName } from '@/shared/utils/audit-models';

/**
 * Implementação Prisma de {@link AuditLogsRepository}.
 * Porte de api-nairim-v2/src/services/AuditLogService.ts.
 * Tenant-scoped: `AuditLog` está em TENANT_MODELS.
 *
 * Camada: infra.
 */

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  LOGIN_FAILED: 'Login Falho',
  CREATE: 'Inclusão',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
};

const SELECT = {
  id: true,
  company: { select: { id: true, name: true } },
  user_name: true,
  user_email: true,
  action: true,
  table_name: true,
  record_id: true,
  ip: true,
  created_at: true,
} as const;

type RawRow = {
  id: string;
  company: { id: string; name: string } | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  ip: string | null;
  created_at: Date;
};

function toRow(log: RawRow): AuditLogRow {
  return {
    id: log.id,
    company: log.company,
    user_name: log.user_name,
    user_email: log.user_email,
    action: log.action,
    action_label: ACTION_LABELS[log.action] ?? log.action,
    table_name: log.table_name,
    table_label: modelLabel(log.table_name),
    record_id: log.record_id,
    ip: log.ip,
    created_at: log.created_at,
  };
}

export class PrismaAuditLogsRepository implements AuditLogsRepository {
  async list(params: GetAuditLogsParams): Promise<PaginatedAuditLogs> {
    const { limit = 30, page = 1, search = '', filters = {}, sortOptions = {} } = params;

    const take = Math.max(1, Math.min(limit, 100));
    const skip = (Math.max(1, page) - 1) * take;

    const where = this.buildWhereClause(filters, search);
    const orderBy = this.buildOrderBy(sortOptions);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take, orderBy, select: SELECT }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map(toRow),
      count: total,
      totalPages: total ? Math.ceil(total / take) : 0,
      currentPage: page,
    };
  }

  async findById(id: string): Promise<AuditLogDetail | null> {
    // findFirst é escopado por empresa pela extensão do Prisma (AuditLog está
    // em TENANT_MODELS): uma empresa não alcança log de outra pelo uuid.
    const log = await prisma.auditLog.findFirst({
      where: { id },
      select: { ...SELECT, old_values: true, new_values: true },
    });
    if (!log) return null;

    const oldValues = (log.old_values as Record<string, unknown> | null) ?? {};
    const newValues = (log.new_values as Record<string, unknown> | null) ?? {};
    const fields = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]));

    const changed_fields = fields.map((field) => ({
      field,
      label: prettifyFieldName(field),
      old_value: oldValues[field] ?? null,
      new_value: newValues[field] ?? null,
    }));

    return { ...toRow(log), changed_fields };
  }

  /** Filtros contextuais: opções de usuário/tabela vêm dos logs já gravados,
   *  não de um cadastro próprio — a lista de "quem já gerou log" é o que faz
   *  sentido filtrar. */
  async getFilters(filters: Record<string, unknown>): Promise<AuditFiltersResponse> {
    const where = this.buildWhereClause(filters, '');

    const logs = await prisma.auditLog.findMany({
      where,
      select: { user_name: true, user_email: true, table_name: true },
    });

    const uniqueUsers = Array.from(
      new Map(
        logs
          .filter((l) => l.user_email)
          .map((l) => [l.user_email, { value: l.user_email as string, label: l.user_name || l.user_email! }]),
      ).values(),
    ).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

    const uniqueTables = Array.from(new Set(logs.map((l) => l.table_name))).sort();

    const dateRange = await prisma.auditLog.aggregate({
      where,
      _min: { created_at: true },
      _max: { created_at: true },
    });

    return {
      filters: [
        {
          field: 'user_email',
          type: 'select',
          label: 'Usuário',
          description: 'Usuário que realizou a ação',
          values: uniqueUsers.map((u) => u.value),
          options: uniqueUsers,
          searchable: true,
          autocomplete: true,
        },
        {
          field: 'action',
          type: 'select',
          label: 'Ação',
          description: 'Tipo de ação registrada',
          options: Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
          searchable: true,
        },
        {
          field: 'table_name',
          type: 'select',
          label: 'Tabela',
          description: 'Tabela/recurso afetado',
          values: uniqueTables,
          options: uniqueTables.map((t) => ({ value: t, label: MODEL_LABELS[t] ?? t })),
          searchable: true,
          autocomplete: true,
        },
        {
          field: 'created_at',
          type: 'date',
          label: 'Período',
          description: 'Data/hora da ação',
          min: dateRange._min.created_at?.toISOString().split('T')[0],
          max: dateRange._max.created_at?.toISOString().split('T')[0],
          dateRange: true,
        },
      ],
    };
  }

  private buildWhereClause(filters: Record<string, unknown>, search: string) {
    const where: Record<string, unknown> = {};

    if (search.trim()) {
      const term = search.trim();
      where.OR = [
        { user_name: { contains: term, mode: 'insensitive' } },
        { user_email: { contains: term, mode: 'insensitive' } },
      ];
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      if (key === 'user_email') {
        where.user_email = String(value);
      } else if (key === 'action') {
        where.action = String(value).toUpperCase();
      } else if (key === 'table_name') {
        where.table_name = String(value);
      } else if (key === 'created_at') {
        if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
          const range = value as { from: string; to: string };
          const fromDate = new Date(range.from);
          const toDate = new Date(range.to);
          toDate.setHours(23, 59, 59, 999);
          if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
            where.created_at = { gte: fromDate, lte: toDate };
          }
        } else if (typeof value === 'string') {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            where.created_at = { gte: start, lte: end };
          }
        }
      }
    });

    return where;
  }

  private buildOrderBy(sortOptions: Record<string, string>) {
    const orderBy: Record<string, 'asc' | 'desc'>[] = [];

    Object.entries(sortOptions).forEach(([field, value]) => {
      if (!value) return;
      const direction = String(value).toLowerCase() === 'desc' ? 'desc' : 'asc';
      if (['created_at', 'action', 'table_name', 'user_name'].includes(field)) {
        orderBy.push({ [field]: direction });
      }
    });

    if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });

    return orderBy;
  }
}

export const prismaAuditLogsRepository = new PrismaAuditLogsRepository();
