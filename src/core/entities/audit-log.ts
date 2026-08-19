/**
 * Entidades de Log de Auditoria (leitura apenas — log é gerado pelo sistema,
 * não cadastrado). Porte de api-nairim-v2/src/types/audit-log.ts.
 *
 * Camada: core.
 */

export interface GetAuditLogsParams {
  limit?: number;
  page?: number;
  search?: string;
  filters?: Record<string, unknown>;
  sortOptions?: Record<string, string>;
}

export interface AuditLogRow {
  id: string;
  company: { id: string; name: string } | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  action_label: string;
  table_name: string;
  table_label: string;
  record_id: string | null;
  /** Descrição legível do registro afetado (Tarefa 8.2) — null quando o log não guardou nada identificável. */
  record_label: string | null;
  ip: string | null;
  /** IP pronto para exibição: IPv4 desembrulhado de `::ffff:` quando é o caso. */
  ip_label: string | null;
  /** true quando o valor exibido é IPv6 de verdade — a coluna sinaliza isso. */
  ip_is_ipv6: boolean;
  created_at: Date;
}

export interface ChangedField {
  field: string;
  label: string;
  old_value: unknown;
  new_value: unknown;
}

export interface AuditLogDetail extends AuditLogRow {
  /** Vazio para LOGIN/LOGIN_FAILED (sem registro de negócio envolvido). */
  changed_fields: ChangedField[];
}

export interface PaginatedAuditLogs {
  data: AuditLogRow[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface AuditFilterOption {
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  label: string;
  description?: string;
  values?: unknown[];
  options?: unknown[];
  searchable?: boolean;
  autocomplete?: boolean;
  dateRange?: boolean;
  min?: string;
  max?: string;
}

export interface AuditFiltersResponse {
  filters: AuditFilterOption[];
}
