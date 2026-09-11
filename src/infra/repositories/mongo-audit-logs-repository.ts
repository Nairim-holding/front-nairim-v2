import { logsCollection, type StoredAuditLog } from '@/infra/database/mongodb';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { Filter } from 'mongodb';
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
  AUDIT_HIDDEN_FIELDS,
  AUDIT_MONEY_FIELDS,
  AUDIT_PERCENT_FIELDS,
  fieldLabel,
  formatAuditIp,
  modelLabel,
  MODEL_LABELS,
  sortAuditFields,
} from '@/shared/utils/audit-models';
import { buildDateTimeCondition } from '@/shared/utils/date-utils';

/**
 * Implementação MongoDB de {@link AuditLogsRepository}.
 * Porte de api-nairim-v2/src/services/AuditLogService.ts.
 * Todas as consultas exigem contexto de empresa.
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
  user_group_id: (ids) => lookup(prisma.userGroup, ids, ['description']),
  owner_id: (ids) => lookup(prisma.owner, ids, ['name']),
  tenant_id: (ids) => lookup(prisma.tenant, ids, ['name']),
  agency_id: (ids) => lookup(prisma.agency, ids, ['trade_name', 'legal_name']),
  property_id: (ids) => lookup(prisma.property, ids, ['title']),
  property_type_id: (ids) => lookup(prisma.propertyType, ids, ['description', 'name']),
  type_id: (ids) => lookup(prisma.propertyType, ids, ['description', 'name']),
  lease_id: (ids) => lookup(prisma.lease, ids, ['contract_number']),
  transaction_id: (ids) => lookup(prisma.transaction, ids, ['description']),
  parent_transaction_id: (ids) => lookup(prisma.transaction, ids, ['description']),
  // Campos de autoria: guardam uuid de User e sairiam crus no diff.
  created_by: (ids) => lookup(prisma.user, ids, ['name', 'email']),
  updated_by: (ids) => lookup(prisma.user, ids, ['name', 'email']),
  deleted_by: (ids) => lookup(prisma.user, ids, ['name', 'email']),
  // Fatura nao tem campo de nome — identifica-se por competencia (MM/AAAA).
  invoice_id: async (ids) => {
    const rows = await prisma.invoice.findMany({
      where: { id: { in: ids } },
      select: { id: true, month: true, year: true },
    });
    return new Map(rows.map((r) => [r.id, `${pad2(r.month)}/${r.year}`]));
  },
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * `created_at` → `15/08/2026 12:53:24` (horário local); campos de data pura
 * (`event_date`, `effective_date`, …) → `15/08/2026` lido em UTC, que é como o
 * banco guarda esses campos (ver `shared/utils/date-utils`). Ler um campo
 * date-only no fuso local devolveria o dia anterior no Brasil.
 *
 * Separador `/` (e não `-`) para bater com a máscara de data usada no resto
 * do sistema — `formatDate` em `utils/formatters`.
 */
function formatAuditDate(field: string, value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const isDateOnly = field.endsWith('_date') || !/[T ]\d{2}:\d{2}/.test(value);
  if (isDateOnly) {
    return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  }

  const day = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  return `${day} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/**
 * Máscara de moeda/percentual dos campos numéricos do diff. O valor chega do
 * JSON do log como number ou string ("15.33") — ambos com ponto decimal, então
 * `Number()` dá conta antes de formatar em pt-BR.
 */
function formatAuditNumber(field: string, value: unknown): string | null {
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num)) return null;

  if (AUDIT_MONEY_FIELDS.has(field)) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  }
  if (AUDIT_PERCENT_FIELDS.has(field)) {
    return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)} %`;
  }
  return null;
}

/** Enums gravados no diff — traduzidos para português amigável. */
const ENUM_LABELS: Record<string, string> = {
  // Status e Situação
  PENDING: 'Pendente',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  EXPIRED: 'Expirado',
  EXPIRING: 'A Vencer',
  AVAILABLE: 'Disponível',
  OCCUPIED: 'Ocupado',
  MAINTENANCE: 'Em Manutenção',
  RENTED: 'Locado',
  SOLD: 'Vendido',
  RESERVED: 'Reservado',

  // Tipos Financeiros e DFC
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
  TAXES: 'Impostos e Tributos',
  VARIABLE_EXPENSE: 'Despesa Variável',
  FIXED_EXPENSE: 'Despesa Fixa',
  PAYROLL: 'Folha de Pagamento',
  FIXED: 'Fixo',
  VARIABLE: 'Variável',

  // Frequência de Recorrência
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  YEARLY: 'Anual',

  // Modos e Condições de Pagamento
  PARCELADO: 'Parcelado',
  RECORRENTE: 'Recorrente',
  CASH: 'À Vista',
  INSTALLMENTS: 'Parcelado',
  IN_FULL_15_DISCOUNT: 'À Vista (15% Desc.)',
  SECOND_INSTALLMENT_10_DISCOUNT: '2ª Parcela (10% Desc.)',
  BANK_SLIP: 'Boleto Bancário',
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  TRANSFER: 'Transferência Bancária',
  CASH_IN_HAND: 'Dinheiro',
  CHECK: 'Cheque',

  // Usuários e Acessos
  MALE: 'Masculino',
  FEMALE: 'Feminino',
  OTHER: 'Outro',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super Administrador',
  DEFAULT: 'Padrão',
  DIRECTOR: 'Diretor',
  MANAGER: 'Gerente',

  // Documentos
  TITLE_DEED: 'Escritura',
  REGISTRATION: 'Matrícula / Registro',
  PROPERTY_RECORD: 'Ficha do Imóvel',
  IMAGE: 'Imagem',
  LEASE_CONTRACT: 'Contrato de Locação',
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

  // Moeda/percentual depois das datas: um campo `_date` nunca cai aqui, e
  // valores numericos chegam como number ou string decimal.
  if (typeof value === 'number' || typeof value === 'string') {
    const masked = formatAuditNumber(field, value);
    if (masked !== null) return masked;
  }

  return value;
}

/** Catálogo de campos de negócio padrão de cada modelo para exibição completa na auditoria */
const MODEL_FIELDS: Record<string, string[]> = {
  Agency: [
    'trade_name',
    'legal_name',
    'cnpj',
    'state_registration',
    'municipal_registration',
    'license_number',
    'commission_percentage',
    'phone',
    'cellphone',
    'email',
    'zip_code',
    'street',
    'number',
    'complement',
    'district',
    'city',
    'state',
  ],
  Property: [
    'title',
    'registration_number',
    'tax_registration',
    'owner_id',
    'agency_id',
    'type_id',
    'center_id',
    'category_id',
    'subcategory_id',
    'bedrooms',
    'bathrooms',
    'half_bathrooms',
    'garage_spaces',
    'area_total',
    'area_built',
    'frontage',
    'furnished',
    'income_tax_withholding',
    'floor_number',
    'zip_code',
    'street',
    'number',
    'complement',
    'district',
    'city',
    'state',
    'notes',
  ],
  Owner: [
    'name',
    'internal_code',
    'cpf',
    'cnpj',
    'occupation',
    'marital_status',
    'state_registration',
    'municipal_registration',
    'phone',
    'cellphone',
    'email',
    'zip_code',
    'street',
    'number',
    'complement',
    'district',
    'city',
    'state',
  ],
  Tenant: [
    'name',
    'internal_code',
    'cpf',
    'cnpj',
    'rg',
    'rg_issuing_body',
    'rg_issuing_state',
    'nationality',
    'occupation',
    'marital_status',
    'state_registration',
    'municipal_registration',
    'phone',
    'cellphone',
    'email',
    'zip_code',
    'street',
    'number',
    'complement',
    'district',
    'city',
    'state',
  ],
  Lease: [
    'contract_number',
    'property_id',
    'tenant_id',
    'owner_id',
    'agency_id',
    'financial_institution_id',
    'start_date',
    'end_date',
    'rent_amount',
    'condo_fee',
    'property_tax',
    'extra_charges',
    'discount_amount',
    'commission_amount',
    'agency_commission',
    'rent_due_day',
    'tax_due_day',
    'condo_due_day',
    'status',
    'payment_condition',
    'insurance_company',
    'insurance_type',
    'insurance_policy',
  ],
  Transaction: [
    'event_date',
    'effective_date',
    'purchase_date',
    'description',
    'amount',
    'status',
    'category_id',
    'subcategory_id',
    'financial_institution_id',
    'card_id',
    'center_id',
    'supplier_id',
    'lease_id',
    'invoice_id',
    'payment_mode',
    'installment_number',
    'total_installments',
    'is_recurring',
    'occurrence_number',
    'recurring_frequency',
    'is_transfer',
    'is_cancellation_charge',
  ],
  Invoice: [
    'card_id',
    'month',
    'year',
    'total_amount',
    'status',
    'closing_date',
    'due_date',
    'paid_date',
    'paid_amount',
  ],
  User: [
    'name',
    'email',
    'birth_date',
    'gender',
    'role',
    'user_group_id',
    'is_active',
    'phone_country_code',
    'phone_area_code',
    'phone',
    'phone_extension',
    'has_time_restriction',
    'photo_url',
  ],
  Card: [
    'name',
    'limit',
    'closing_day',
    'due_day',
    'brand',
    'current_balance',
    'is_active',
  ],
  Center: [
    'name',
    'type',
    'is_active',
  ],
  Category: [
    'name',
    'type',
    'is_active',
    'is_system',
    'dfc_group',
  ],
  Subcategory: [
    'category_id',
    'name',
    'is_active',
  ],
  Supplier: [
    'legal_name',
    'trade_name',
    'cnpj',
    'cpf',
    'agency_id',
    'state_registration',
    'municipal_registration',
    'internal_code',
    'occupation',
    'marital_status',
    'is_active',
    'phone',
    'cellphone',
    'email',
    'zip_code',
    'street',
    'number',
    'complement',
    'district',
    'city',
    'state',
  ],
  FinancialInstitution: [
    'name',
    'account_number',
    'agency_number',
    'bank_number',
    'is_active',
  ],
  PropertyType: [
    'description',
  ],
  Document: [
    'type',
    'description',
    'property_id',
    'lease_id',
    'transaction_id',
    'is_featured',
    'file_type',
  ],
  UserGroup: [
    'description',
  ],
  PropertyValue: [
    'purchase_value',
    'market_value',
    'rental_value',
    'condo_fee',
    'property_tax',
    'status',
    'sale_value',
    'sale_date',
    'purchase_date',
    'notes',
  ],
  PropertyIptu: [
    'year',
    'property_tax',
    'property_tax_cash',
    'property_tax_cash_due_date',
    'property_tax_first_installment',
    'property_tax_first_installment_due_date',
    'property_tax_second_installment',
    'property_tax_second_installment_due_date',
    'iptu_installments_count',
    'payment_condition',
  ],
};

/** Mapeamento robusto de nome de tabela/model (singular, plural, snake_case) para o delegate do Prisma e campos de negócio */
const MODEL_MAPPING: Record<string, { fields?: string[] }> = {
  agency: { fields: MODEL_FIELDS.Agency },
  agencies: { fields: MODEL_FIELDS.Agency },
  property: { fields: MODEL_FIELDS.Property },
  properties: { fields: MODEL_FIELDS.Property },
  propertytype: { fields: MODEL_FIELDS.PropertyType },
  property_type: { fields: MODEL_FIELDS.PropertyType },
  property_types: { fields: MODEL_FIELDS.PropertyType },
  propertytypes: { fields: MODEL_FIELDS.PropertyType },
  propertyvalue: { fields: MODEL_FIELDS.PropertyValue },
  property_value: { fields: MODEL_FIELDS.PropertyValue },
  property_values: { fields: MODEL_FIELDS.PropertyValue },
  propertyvalues: { fields: MODEL_FIELDS.PropertyValue },
  propertyiptu: { fields: MODEL_FIELDS.PropertyIptu },
  property_iptu: { fields: MODEL_FIELDS.PropertyIptu },
  property_iptus: { fields: MODEL_FIELDS.PropertyIptu },
  user: { fields: MODEL_FIELDS.User },
  users: { fields: MODEL_FIELDS.User },
  owner: { fields: MODEL_FIELDS.Owner },
  owners: { fields: MODEL_FIELDS.Owner },
  tenant: { fields: MODEL_FIELDS.Tenant },
  tenants: { fields: MODEL_FIELDS.Tenant },
  lease: { fields: MODEL_FIELDS.Lease },
  leases: { fields: MODEL_FIELDS.Lease },
  financialinstitution: { fields: MODEL_FIELDS.FinancialInstitution },
  financial_institution: { fields: MODEL_FIELDS.FinancialInstitution },
  financial_institutions: { fields: MODEL_FIELDS.FinancialInstitution },
  financialinstitutions: { fields: MODEL_FIELDS.FinancialInstitution },
  category: { fields: MODEL_FIELDS.Category },
  categories: { fields: MODEL_FIELDS.Category },
  subcategory: { fields: MODEL_FIELDS.Subcategory },
  subcategories: { fields: MODEL_FIELDS.Subcategory },
  card: { fields: MODEL_FIELDS.Card },
  cards: { fields: MODEL_FIELDS.Card },
  center: { fields: MODEL_FIELDS.Center },
  centers: { fields: MODEL_FIELDS.Center },
  supplier: { fields: MODEL_FIELDS.Supplier },
  suppliers: { fields: MODEL_FIELDS.Supplier },
  transaction: { fields: MODEL_FIELDS.Transaction },
  transactions: { fields: MODEL_FIELDS.Transaction },
  invoice: { fields: MODEL_FIELDS.Invoice },
  invoices: { fields: MODEL_FIELDS.Invoice },
  recurringconfig: { fields: MODEL_FIELDS.RecurringConfig },
  recurring_config: { fields: MODEL_FIELDS.RecurringConfig },
  recurring_configs: { fields: MODEL_FIELDS.RecurringConfig },
  recurringconfigs: { fields: MODEL_FIELDS.RecurringConfig },
  planning: { fields: MODEL_FIELDS.Planning },
  plannings: { fields: MODEL_FIELDS.Planning },
  usergroup: { fields: MODEL_FIELDS.UserGroup },
  user_group: { fields: MODEL_FIELDS.UserGroup },
  user_groups: { fields: MODEL_FIELDS.UserGroup },
  usergroups: { fields: MODEL_FIELDS.UserGroup },
  document: { fields: MODEL_FIELDS.Document },
  documents: { fields: MODEL_FIELDS.Document },
  company: { fields: [] },
  companies: { fields: [] },
  companybranding: { fields: [] },
  company_branding: { fields: [] },
};

export class MongoAuditLogsRepository implements AuditLogsRepository {
  async list(params: GetAuditLogsParams): Promise<PaginatedAuditLogs> {
    const { limit = 150, page = 1, search = '', filters = {}, sortOptions = {} } = params;

    const take = Math.max(1, Math.min(limit, 150));
    const skip = (Math.max(1, page) - 1) * take;

    const where = this.buildWhereClause(filters, search);
    const orderBy = this.buildOrderBy(sortOptions);

    const [logs, total] = await Promise.all([
      (await logsCollection()).find(where).sort(orderBy).skip(skip).limit(take).toArray(),
      (await logsCollection()).countDocuments(where),
    ]);

    return {
      data: logs.map(toRow),
      count: total,
      totalPages: total ? Math.ceil(total / take) : 0,
      currentPage: page,
    };
  }

  async findById(id: string): Promise<AuditLogDetail | null> {
    const log = await (await logsCollection()).findOne({ ...this.buildWhereClause({}, ""), id });
    if (!log) return null;

    const oldValues = (log.old_values as Record<string, unknown> | null) ?? {};
    const newValues = (log.new_values as Record<string, unknown> | null) ?? {};

    const fullOldValues: Record<string, unknown> = { ...oldValues };
    const fullNewValues: Record<string, unknown> = { ...newValues };

    const cleanTable = (log.table_name || '').toLowerCase().trim();
    const modelInfo =
      MODEL_MAPPING[cleanTable] ??
      MODEL_MAPPING[cleanTable.replace(/[^a-z0-9]/g, '')] ??
      null;

    // Snapshots são históricos; não completar com valores atuais do cadastro.

    // Garante que TODOS os campos da tabela existam na lista para exibição completa
    const catalogFields =
      modelInfo?.fields ??
      MODEL_FIELDS[log.table_name];

    if (catalogFields) {
      for (const field of catalogFields) {
        if (!(field in fullOldValues)) {
          fullOldValues[field] = null;
        }
        if (!(field in fullNewValues)) {
          fullNewValues[field] = null;
        }
      }
    }

    const fields = Array.from(
      new Set([...(catalogFields ?? []), ...Object.keys(fullOldValues), ...Object.keys(fullNewValues)]),
    );

    // Filtra campos técnicos (IDs internos) e exibe todos os campos da tabela
    const visibleFields = fields.filter((field) => {
      if (AUDIT_HIDDEN_FIELDS.has(field)) return false;
      // Chaves estrangeiras não reconhecidas para lookup não são exibidas ao usuário
      if (field.endsWith('_id') && !REFERENCE_LOOKUPS[field]) return false;
      return true;
    });

    const names = await resolveReferenceNames(visibleFields, [fullOldValues, fullNewValues]);

    const changed_fields = sortAuditFields(
      visibleFields
        .map((field) => {
          const rawOld = displayValue(field, fullOldValues[field], names);
          const rawNew = displayValue(field, fullNewValues[field], names);

          // Se for um UUID cru sem tradução, não exibe ao usuário
          const isRawUuidOld = typeof rawOld === 'string' && UUID_RE.test(rawOld.trim());
          const isRawUuidNew = typeof rawNew === 'string' && UUID_RE.test(rawNew.trim());

          if (
            (isRawUuidOld || isEmptyValue(rawOld)) &&
            (isRawUuidNew || isEmptyValue(rawNew)) &&
            (field.endsWith('_id') || field === 'id')
          ) {
            return null;
          }

          return {
            field,
            label: fieldLabel(field),
            old_value: isRawUuidOld ? null : rawOld,
            new_value: isRawUuidNew ? null : rawNew,
          };
        })
        .filter((f): f is { field: string; label: string; old_value: unknown; new_value: unknown } => f !== null),
    );

    return { ...toRow(log), changed_fields };
  }

  /** Filtros contextuais: opções de usuário/tabela vêm dos logs já gravados,
   *  não de um cadastro próprio — a lista de "quem já gerou log" é o que faz
   *  sentido filtrar. */
  async getFilters(filters: Record<string, unknown>): Promise<AuditFiltersResponse> {
    const where = this.buildWhereClause(filters, '');

    const logs = await (await logsCollection()).aggregate<{user_name: string | null; user_email: string | null; table_name: string}>([
      { $match: where },
      { $group: { _id: { user_name: '$user_name', user_email: '$user_email', table_name: '$table_name' } } },
      { $replaceRoot: { newRoot: '$_id' } },
    ]).toArray();

    const uniqueUsers = Array.from(
      new Map(
        logs
          .filter((l) => l.user_email)
          .map((l) => [l.user_email, { value: l.user_email as string, label: l.user_name || l.user_email! }]),
      ).values(),
    ).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

    const uniqueTables = Array.from(new Set(logs.map((l) => l.table_name))).sort();

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
          dateRange: true,
        },
      ],
    };
  }

  private buildWhereClause(filters: Record<string, unknown>, search: string): Filter<StoredAuditLog> {
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Contexto de empresa obrigatório para logs.');
    const where: Filter<StoredAuditLog> = { company_id: companyId };
    if (search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, match => '\\' + match);
      where.$or = [
        { user_name: { $regex: term, $options: 'i' } },
        { user_email: { $regex: term, $options: 'i' } },
      ];
    }
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      if (key === 'user_email') where.user_email = String(value);
      else if (key === 'action') where.action = String(value).toUpperCase();
      else if (key === 'table_name') where.table_name = String(value);
      else if (key === 'created_at') {
        const condition = buildDateTimeCondition(value);
        if (Object.keys(condition).length) where.created_at = Object.fromEntries(Object.entries(condition).map(([key, date]) => ['$' + key, date]));
      }
    }
    return where;
  }
  private buildOrderBy(sortOptions: Record<string, string>) {
    const orderBy: Record<string, 1 | -1> = {};
    for (const [field, value] of Object.entries(sortOptions)) {
      if (value && ['created_at', 'action', 'table_name', 'user_name'].includes(field)) orderBy[field] = value.toLowerCase() === 'desc' ? -1 : 1;
    }
    if (!Object.keys(orderBy).length) orderBy.created_at = -1;
    orderBy.id = -1;
    return orderBy;
  }
}
export const mongoAuditLogsRepository = new MongoAuditLogsRepository();
