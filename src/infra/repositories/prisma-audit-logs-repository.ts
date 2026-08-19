import prisma from '@/infra/database/prisma';
import type { AuditLogsRepository } from '@/core/repositories/audit-logs-repository';
import type {
  AuditFiltersResponse,
  AuditLogDetail,
  AuditLogRow,
  GetAuditLogsParams,
  PaginatedAuditLogs,
} from '@/core/entities/audit-log';
import {
  AUDIT_CONTROL_FIELDS,
  fieldLabel,
  formatAuditIp,
  modelLabel,
  MODEL_LABELS,
  sortAuditFields,
} from '@/shared/utils/audit-models';

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
  // Só para derivar a descrição legível do registro na coluna "Registro"
  // (Tarefa 8.2) — o uuid cru não dizia nada ao usuário.
  old_values: true,
  new_values: true,
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
  old_values?: unknown;
  new_values?: unknown;
};

/** Campos que costumam identificar um registro para uma pessoa, em ordem de preferência. */
const RECORD_LABEL_FIELDS = [
  'description',
  'name',
  'title',
  'trade_name',
  'legal_name',
  'contract_number',
  'file_name',
  'email',
];

/** Extrai do diff gravado uma descrição legível do registro afetado. */
function recordLabelOf(log: RawRow): string | null {
  const sources = [log.new_values, log.old_values].filter(
    (v): v is Record<string, unknown> => !!v && typeof v === 'object',
  );

  for (const source of sources) {
    for (const field of RECORD_LABEL_FIELDS) {
      const value = source[field];
      if (typeof value === 'string' && value.trim() !== '') return value.trim();
    }
  }
  return null;
}

function toRow(log: RawRow): AuditLogRow {
  const ip = formatAuditIp(log.ip);

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
    record_label: recordLabelOf(log),
    ip: log.ip,
    ip_label: ip?.value ?? null,
    ip_is_ipv6: ip?.isIPv6 ?? false,
    created_at: log.created_at,
  };
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Campo de referência → como buscar o nome legível (Tarefa 8.2). Todos os
 * models aqui, exceto Company, são tenant-scoped: a extensão do Prisma já
 * limita a busca à empresa ativa.
 */
const REFERENCE_LOOKUPS: Record<string, (ids: string[]) => Promise<Map<string, string>>> = {
  category_id: (ids) => lookup(prisma.category, ids, ['name']),
  subcategory_id: (ids) => lookup(prisma.subcategory, ids, ['name']),
  center_id: (ids) => lookup(prisma.center, ids, ['name']),
  card_id: (ids) => lookup(prisma.card, ids, ['name']),
  financial_institution_id: (ids) => lookup(prisma.financialInstitution, ids, ['name']),
  supplier_id: (ids) => lookup(prisma.supplier, ids, ['trade_name', 'legal_name']),
  company_id: (ids) => lookup(prisma.company, ids, ['name']),
  user_id: (ids) => lookup(prisma.user, ids, ['name', 'email']),
  owner_id: (ids) => lookup(prisma.owner, ids, ['name']),
  tenant_id: (ids) => lookup(prisma.tenant, ids, ['name']),
  agency_id: (ids) => lookup(prisma.agency, ids, ['trade_name', 'legal_name']),
  property_id: (ids) => lookup(prisma.property, ids, ['title']),
  property_type_id: (ids) => lookup(prisma.propertyType, ids, ['name']),
  lease_id: (ids) => lookup(prisma.lease, ids, ['contract_number']),
  transaction_id: (ids) => lookup(prisma.transaction, ids, ['description']),
  parent_transaction_id: (ids) => lookup(prisma.transaction, ids, ['description']),
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function lookup(delegate: any, ids: string[], labelFields: string[]): Promise<Map<string, string>> {
  const select: Record<string, boolean> = { id: true };
  for (const field of labelFields) select[field] = true;

  const rows: any[] = await delegate.findMany({ where: { id: { in: ids } }, select });

  const map = new Map<string, string>();
  for (const row of rows) {
    const label = labelFields.map((f) => row[f]).find((v) => typeof v === 'string' && v.trim() !== '');
    if (label) map.set(row.id, String(label));
  }
  return map;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Resolve, em lote, os uuids dos campos de referência presentes no diff para
 * os nomes correspondentes. Chave do mapa: `campo::uuid`.
 */
async function resolveReferenceNames(
  fields: string[],
  sources: Record<string, unknown>[],
): Promise<Map<string, string>> {
  const idsByField = new Map<string, Set<string>>();

  for (const field of fields) {
    if (!REFERENCE_LOOKUPS[field]) continue;
    for (const source of sources) {
      const value = source[field];
      if (typeof value === 'string' && value.trim() !== '') {
        const set = idsByField.get(field) ?? new Set<string>();
        set.add(value);
        idsByField.set(field, set);
      }
    }
  }

  const resolved = new Map<string, string>();

  await Promise.all(
    Array.from(idsByField.entries()).map(async ([field, ids]) => {
      try {
        const names = await REFERENCE_LOOKUPS[field](Array.from(ids));
        for (const [id, name] of names) resolved.set(`${field}::${id}`, name);
      } catch (error) {
        // Referência apagada ou model indisponível: mantém o uuid cru em vez
        // de derrubar o detalhe inteiro do log.
        console.warn(`[auditLogs] Falha ao resolver ${field}:`, (error as Error).message);
      }
    }),
  );

  return resolved;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * `created_at` → `15-08-2026 — 12:53:24` (horário local); campos de data pura
 * (`event_date`, `effective_date`, …) → `15-08-2026` lido em UTC, que é como o
 * banco guarda esses campos (ver `shared/utils/date-utils`). Ler um campo
 * date-only no fuso local devolveria o dia anterior no Brasil.
 */
function formatAuditDate(field: string, value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const isDateOnly = field.endsWith('_date') || !/[T ]\d{2}:\d{2}/.test(value);
  if (isDateOnly) {
    return `${pad2(date.getUTCDate())}-${pad2(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
  }

  const day = `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
  return `${day} — ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** Enums gravados no diff — o usuário não reconhece `COMPLETED`/`MONTHLY`. */
const ENUM_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  EXPIRING: 'A Vencer',
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  YEARLY: 'Anual',
};

/** Valor pronto para exibição: nome no lugar do uuid e data em formato amigável. */
function displayValue(field: string, value: unknown, names: Map<string, string>): unknown {
  if (isEmptyValue(value)) return null;

  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';

  if (typeof value === 'string') {
    if (ENUM_LABELS[value]) return ENUM_LABELS[value];
    const name = names.get(`${field}::${value}`);
    if (name) return name;
    if (ISO_DATE_RE.test(value)) return formatAuditDate(field, value);
  }

  if (value instanceof Date) return formatAuditDate(field, value.toISOString());

  return value;
}

export class PrismaAuditLogsRepository implements AuditLogsRepository {
  async list(params: GetAuditLogsParams): Promise<PaginatedAuditLogs> {
    const { limit = 150, page = 1, search = '', filters = {}, sortOptions = {} } = params;

    const take = Math.max(1, Math.min(limit, 150));
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
      select: SELECT,
    });
    if (!log) return null;

    const oldValues = (log.old_values as Record<string, unknown> | null) ?? {};
    const newValues = (log.new_values as Record<string, unknown> | null) ?? {};
    const fields = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]));

    // Campo interno de controle sem valor nos dois lados não vira linha
    // (Tarefa 8.2) — só polui o diff com "— → —".
    const visibleFields = fields.filter((field) => {
      if (!AUDIT_CONTROL_FIELDS.has(field)) return true;
      return !isEmptyValue(oldValues[field]) || !isEmptyValue(newValues[field]);
    });

    const names = await resolveReferenceNames(visibleFields, [oldValues, newValues]);

    const changed_fields = sortAuditFields(
      visibleFields.map((field) => ({
        field,
        label: fieldLabel(field),
        old_value: displayValue(field, oldValues[field], names),
        new_value: displayValue(field, newValues[field], names),
      })),
    );

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
