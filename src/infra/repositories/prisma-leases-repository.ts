import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { LeasesRepository } from '@/core/repositories/leases-repository';
import type {
  CancelLeaseInput,
  CancelLeaseResult,
  CancellationPreview,
  CreateLeaseData,
  Lease,
  ListLeasesParams,
  PaginatedLeases,
  UpdateLeaseData,
} from '@/core/entities/lease';
import { parseLocalDate } from '@/shared/utils/date-utils';

/**
 * Implementação Prisma de {@link LeasesRepository}.
 * Porte de api-nairim-v2/src/services/LeaseService.ts (+ os métodos de
 * documentos de locação do DocumentService).
 * Tenant-scoped: `Lease` está em TENANT_MODELS.
 *
 * Camada: infra.
 */

const DIRECT_FIELDS = [
  'id', 'contract_number', 'start_date', 'end_date', 'rent_amount', 'condo_fee', 'property_tax',
  'property_tax_cash', 'property_tax_cash_due_date', 'property_tax_first_installment', 'property_tax_first_installment_due_date',
  'property_tax_second_installment', 'property_tax_second_installment_due_date', 'iptu_installments_count',
  'extra_charges', 'discount_amount', 'commission_amount', 'rent_due_day', 'tax_due_day', 'condo_due_day', 'status', 'payment_condition',
  'cancellation_penalty', 'other_cancellation_amounts', 'cancellation_justification', 'canceled_at', 'created_at', 'updated_at',
];

/** Aliases de ordenação por relação (usados quando a ordenação roda em memória). */
const RELATION_FIELD_MAP: Record<string, string> = {
  'property.title': 'property.title',
  property_title: 'property.title',
  'property.type.description': 'property.type.description',
  type_description: 'property.type.description',
  'owner.name': 'owner.name',
  owner_name: 'owner.name',
  'tenant.name': 'tenant.name',
  tenant_name: 'tenant.name',
};

const LIST_INCLUDE = {
  property: { select: { id: true, title: true, type: { select: { id: true, description: true } } } },
  owner: { select: { id: true, name: true } },
  tenant: { select: { id: true, name: true } },
};

const DETAIL_INCLUDE = {
  property: { include: { type: true, addresses: { where: { deleted_at: null }, include: { address: true } }, owner: true, category: true, subcategory: true, center: true } },
  owner: { include: { addresses: { where: { deleted_at: null }, include: { address: true } }, contacts: { where: { deleted_at: null }, include: { channels: { where: { deleted_at: null }, orderBy: { display_order: 'asc' as const } } } } } },
  tenant: { include: { addresses: { where: { deleted_at: null }, include: { address: true } }, contacts: { where: { deleted_at: null }, include: { channels: { where: { deleted_at: null }, orderBy: { display_order: 'asc' as const } } } } } },
  type: true,
  agency: { include: { commission_category: true, commission_subcategory: true } },
  financial_institution: true,
  documents: { where: { deleted_at: null }, orderBy: { created_at: 'asc' as const } },
};

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[çÇ]/g, 'c').replace(/[ñÑ]/g, 'n').toLowerCase().trim();
}

/** Status calculado por data (idêntico a `LeaseService.determineStatus`). */
function determineStatus(endDate: Date): 'EXPIRED' | 'EXPIRING' | 'ACTIVE' {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const oneMonthFromNow = new Date(now);
  oneMonthFromNow.setMonth(now.getMonth() + 1);
  if (end < now) return 'EXPIRED';
  if (end <= oneMonthFromNow) return 'EXPIRING';
  return 'ACTIVE';
}

/** Recalcula o status de exibição (CANCELED nunca é sobrescrito). */
function processLeaseStatus<T extends { status?: string; end_date?: Date }>(lease: T): T {
  if (!lease) return lease;
  if (lease.status === 'CANCELED' || !lease.end_date) return lease;
  return { ...lease, status: determineStatus(lease.end_date) };
}

/**
 * ⚠️ Achado em teste E2E (2026-08-13, mesma causa do achado em
 * `prisma-properties-repository.ts`): `Lease` tem 6 campos `@db.Decimal` no
 * schema (rent_amount, condo_fee, property_tax, extra_charges,
 * commission_amount, agency_commission). O Prisma retorna instâncias de
 * `Decimal`, que quebram o boundary RSC ao serem passadas para Client
 * Components sem conversão. `list()`/`findById()` retornavam o registro cru
 * (só `processLeaseStatus` tocava o objeto, sem mexer nos Decimal).
 */
function serializeLease<T extends Record<string, any>>(lease: T): T {
  if (!lease) return lease;
  return {
    ...lease,
    rent_amount: lease.rent_amount != null ? Number(lease.rent_amount) : lease.rent_amount,
    condo_fee: lease.condo_fee != null ? Number(lease.condo_fee) : lease.condo_fee,
    property_tax: lease.property_tax != null ? Number(lease.property_tax) : lease.property_tax,
    extra_charges: lease.extra_charges != null ? Number(lease.extra_charges) : lease.extra_charges,
    discount_amount: lease.discount_amount != null ? Number(lease.discount_amount) : lease.discount_amount,
    commission_amount: lease.commission_amount != null ? Number(lease.commission_amount) : lease.commission_amount,
    agency_commission: lease.agency_commission != null ? Number(lease.agency_commission) : lease.agency_commission,
    cancellation_penalty: lease.cancellation_penalty != null ? Number(lease.cancellation_penalty) : lease.cancellation_penalty,
    other_cancellation_amounts: lease.other_cancellation_amounts != null ? Number(lease.other_cancellation_amounts) : lease.other_cancellation_amounts,
    property_tax_cash: lease.property_tax_cash != null ? Number(lease.property_tax_cash) : lease.property_tax_cash,
    property_tax_first_installment: lease.property_tax_first_installment != null ? Number(lease.property_tax_first_installment) : lease.property_tax_first_installment,
    property_tax_second_installment: lease.property_tax_second_installment != null ? Number(lease.property_tax_second_installment) : lease.property_tax_second_installment,
  };
}

function serializeLeases<T extends Record<string, any>>(leases: T[]): T[] {
  return leases.map((l) => serializeLease(l));
}

function safeGet(obj: any, path: string): unknown {
  return path.split('.').reduce((acc: any, part) => (acc === null || acc === undefined ? undefined : acc[part]), obj);
}

function buildDateCondition(value: unknown): Record<string, Date> {
  if (typeof value === 'object' && value && 'from' in value && 'to' in value) {
    const range = value as { from: string; to: string };
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) return { gte: fromDate, lte: toDate };
  } else if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      return { gte: startOfDay, lte: endOfDay };
    }
  }
  return {};
}

function buildFilterConditions(filters: Record<string, unknown>): Record<string, any> {
  const conditions: Record<string, any> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    const values = Array.isArray(value) ? value : [value];

    if (key === 'status' || key === 'payment_condition') {
      conditions[key] = { in: values.map(String) };
    } else if (['contract_number', 'rent_due_day', 'tax_due_day', 'condo_due_day'].includes(key)) {
      conditions[key] = { contains: String(value), mode: 'insensitive' };
    } else if (['rent_amount', 'condo_fee', 'property_tax', 'property_tax_cash', 'property_tax_first_installment', 'property_tax_second_installment', 'extra_charges', 'discount_amount', 'commission_amount'].includes(key)) {
      const n = parseFloat(String(value));
      if (!isNaN(n)) conditions[key] = n;
    } else if (['start_date', 'end_date', 'canceled_at', 'created_at'].includes(key)) {
      conditions[key] = buildDateCondition(value);
    } else if (key === 'property_title') {
      if (!conditions.property) conditions.property = {};
      conditions.property.title = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'owner_name') {
      if (!conditions.owner) conditions.owner = {};
      conditions.owner.name = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'tenant_name') {
      if (!conditions.tenant) conditions.tenant = {};
      conditions.tenant.name = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'type_description') {
      if (!conditions.property) conditions.property = { type: {} };
      else if (!conditions.property.type) conditions.property.type = {};
      conditions.property.type.description = { contains: String(value), mode: 'insensitive' };
    }
  });
  return conditions;
}

function buildWhere(filters: Record<string, unknown>): Record<string, unknown> {
  const where: Record<string, unknown> = { deleted_at: null };
  const conditions = buildFilterConditions(filters);
  if (Object.keys(conditions).length > 0) where.AND = [conditions];
  return where;
}

function buildOrderBy(sortOptions: Record<string, string>): Record<string, unknown>[] {
  const orderBy: Record<string, unknown>[] = [];
  Object.entries(sortOptions).forEach(([field, value]) => {
    if (!value) return;
    const direction = String(value).toLowerCase() === 'desc' ? 'desc' : 'asc';
    const realField = field.replace('sort_', '');
    if (realField === 'property_title' || realField === 'property.title') orderBy.push({ property: { title: direction } });
    else if (realField === 'type_description' || realField === 'property.type.description') orderBy.push({ property: { type: { description: direction } } });
    else if (realField === 'owner_name' || realField === 'owner.name') orderBy.push({ owner: { name: direction } });
    else if (realField === 'tenant_name' || realField === 'tenant.name') orderBy.push({ tenant: { name: direction } });
    else if (DIRECT_FIELDS.includes(realField)) orderBy.push({ [realField]: direction });
  });
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
  return orderBy;
}

function filterBySearch(leases: any[], searchTerm: string): any[] {
  if (!searchTerm.trim()) return leases;
  const normalized = normalizeText(searchTerm);
  return leases.filter((lease) => {
    const direct = [lease.contract_number, lease.id, lease.status, lease.payment_condition].filter(Boolean).join(' ');
    const propertyFields = [lease.property?.title, lease.property?.type?.description].filter(Boolean).join(' ');
    const ownerFields = [lease.owner?.name].filter(Boolean).join(' ');
    const tenantFields = [lease.tenant?.name].filter(Boolean).join(' ');
    return normalizeText([direct, propertyFields, ownerFields, tenantFields].join(' ')).includes(normalized);
  });
}

function sortByDirectField(items: any[], field: string, direction: 'asc' | 'desc'): any[] {
  return [...items].sort((a, b) => {
    const strA = normalizeText(String(a[field] ?? ''));
    const strB = normalizeText(String(b[field] ?? ''));
    return direction === 'asc' ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' }) : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
  });
}

function sortByRelatedField(items: any[], field: string, direction: 'asc' | 'desc'): any[] {
  const path = RELATION_FIELD_MAP[field];
  if (!path) return items;
  return [...items].sort((a, b) => {
    const strA = normalizeText(String(safeGet(a, path) ?? ''));
    const strB = normalizeText(String(safeGet(b, path) ?? ''));
    return direction === 'asc' ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' }) : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
  });
}

/**
 * Monta o `data` do create/update de Lease a partir do input + registro
 * existente (semântica "campo presente no input sobrescreve; ausente preserva",
 * idêntica ao updateLease do backend; no create, `existing` é undefined).
 */
function buildLeaseData(data: CreateLeaseData | UpdateLeaseData, existing?: any) {
  const num = (v: unknown) => (v != null && v !== '' ? Number(v) : null);
  return {
    property_id: data.property_id ?? existing?.property_id,
    type_id: data.type_id ?? existing?.type_id,
    owner_id: data.owner_id ?? existing?.owner_id,
    tenant_id: data.tenant_id ?? existing?.tenant_id,
    agency_id: data.agency_id !== undefined ? (data.agency_id || null) : (existing?.agency_id ?? null),
    financial_institution_id: data.financial_institution_id !== undefined ? (data.financial_institution_id || null) : (existing?.financial_institution_id ?? null),
    adjustment_index_id: data.adjustment_index_id !== undefined ? (data.adjustment_index_id || null) : (existing?.adjustment_index_id ?? null),
    contract_number: data.contract_number ?? existing?.contract_number,
    start_date: data.start_date ? new Date(data.start_date) : existing?.start_date,
    end_date: data.end_date ? new Date(data.end_date) : existing?.end_date,
    rent_amount: data.rent_amount != null ? Number(data.rent_amount) : existing?.rent_amount,
    condo_fee: data.condo_fee !== undefined ? num(data.condo_fee) : (existing?.condo_fee ?? null),
    property_tax: data.property_tax !== undefined ? num(data.property_tax) : (existing?.property_tax ?? null),
    property_tax_cash: data.property_tax_cash !== undefined ? num(data.property_tax_cash) : (existing?.property_tax_cash ?? null),
    property_tax_cash_due_date: data.property_tax_cash_due_date !== undefined ? (data.property_tax_cash_due_date ? new Date(data.property_tax_cash_due_date) : null) : (existing?.property_tax_cash_due_date ?? null),
    property_tax_first_installment: data.property_tax_first_installment !== undefined ? num(data.property_tax_first_installment) : (existing?.property_tax_first_installment ?? null),
    property_tax_first_installment_due_date: data.property_tax_first_installment_due_date !== undefined ? (data.property_tax_first_installment_due_date ? new Date(data.property_tax_first_installment_due_date) : null) : (existing?.property_tax_first_installment_due_date ?? null),
    property_tax_second_installment: data.property_tax_second_installment !== undefined ? num(data.property_tax_second_installment) : (existing?.property_tax_second_installment ?? null),
    property_tax_second_installment_due_date: data.property_tax_second_installment_due_date !== undefined ? (data.property_tax_second_installment_due_date ? new Date(data.property_tax_second_installment_due_date) : null) : (existing?.property_tax_second_installment_due_date ?? null),
    iptu_year: data.iptu_year !== undefined ? (data.iptu_year ? Number(data.iptu_year) : null) : (existing?.iptu_year ?? null),
    iptu_installments_count: data.iptu_installments_count !== undefined ? (data.iptu_installments_count ? Number(data.iptu_installments_count) : null) : (existing?.iptu_installments_count ?? null),
    iptu_installments: data.iptu_installments !== undefined ? (Array.isArray(data.iptu_installments) ? data.iptu_installments : null) : (existing?.iptu_installments ?? null),
    iptu_installments_due_dates: data.iptu_installments_due_dates !== undefined ? (Array.isArray(data.iptu_installments_due_dates) ? data.iptu_installments_due_dates : null) : (existing?.iptu_installments_due_dates ?? null),
    extra_charges: data.extra_charges !== undefined ? num(data.extra_charges) : (existing?.extra_charges ?? null),
    discount_amount: data.discount_amount !== undefined ? num(data.discount_amount) : (existing?.discount_amount ?? null),
    commission_amount: data.commission_amount !== undefined ? num(data.commission_amount) : (existing?.commission_amount ?? null),
    insurance_company: data.insurance_company !== undefined ? (data.insurance_company ? String(data.insurance_company).trim() : null) : (existing?.insurance_company ?? null),
    insurance_type: data.insurance_type !== undefined ? (data.insurance_type ? String(data.insurance_type).trim() : null) : (existing?.insurance_type ?? null),
    insurance_policy: data.insurance_policy !== undefined ? (data.insurance_policy ? String(data.insurance_policy).trim() : null) : (existing?.insurance_policy ?? null),
    guarantors: data.guarantors !== undefined ? (Array.isArray(data.guarantors) ? data.guarantors : null) : (existing?.guarantors ?? null),
    rent_due_day: data.rent_due_day != null ? Number(data.rent_due_day) : existing?.rent_due_day,
    tax_due_day: data.tax_due_day !== undefined ? num(data.tax_due_day) : (existing?.tax_due_day ?? null),
    condo_due_day: data.condo_due_day !== undefined ? num(data.condo_due_day) : (existing?.condo_due_day ?? null),
    payment_condition: data.payment_condition !== undefined ? data.payment_condition : (existing?.payment_condition ?? null),
    cancellation_penalty: data.cancellation_penalty !== undefined ? num(data.cancellation_penalty) : (existing?.cancellation_penalty ?? null),
    other_cancellation_amounts: data.other_cancellation_amounts !== undefined ? num(data.other_cancellation_amounts) : (existing?.other_cancellation_amounts ?? null),
    cancellation_justification: data.cancellation_justification !== undefined ? data.cancellation_justification : (existing?.cancellation_justification ?? null),
  };
}

export class PrismaLeasesRepository implements LeasesRepository {
  async list(params: ListLeasesParams): Promise<PaginatedLeases> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters);

    const sortField = Object.keys(params.sortOptions)[0];
    const sortDirection = sortField
      ? (String(params.sortOptions[sortField]).toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
      : undefined;
    const isRelationSort = !!(sortField && RELATION_FIELD_MAP[sortField]);

    let leases: any[] = [];
    let total = 0;

    if (params.search?.trim() || (sortField && sortDirection && isRelationSort)) {
      const all = await prisma.lease.findMany({ where: where as never, include: LIST_INCLUDE });
      let filtered = all.map((l) => processLeaseStatus(l));
      if (params.search?.trim()) filtered = filterBySearch(filtered, params.search);
      total = filtered.length;

      if (sortField && sortDirection) {
        leases = isRelationSort
          ? sortByRelatedField(filtered, sortField, sortDirection)
          : sortByDirectField(filtered, sortField, sortDirection);
      } else {
        leases = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      leases = leases.slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.lease.findMany({ where: where as never, skip, take, orderBy: buildOrderBy(params.sortOptions) as never, include: LIST_INCLUDE }),
        prisma.lease.count({ where: where as never }),
      ]);
      leases = data.map((l) => processLeaseStatus(l));
      total = count;
    }

    return { data: serializeLeases(leases) as Lease[], count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    const where: Record<string, any> = { deleted_at: null };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value || value === '') return;
      if (key === 'contract_number') where.contract_number = { contains: String(value), mode: 'insensitive' };
      else if (key === 'property_title') where.property = { title: { contains: String(value), mode: 'insensitive' } };
      else if (key === 'owner_name') where.owner = { name: { contains: String(value), mode: 'insensitive' } };
      else if (key === 'tenant_name') where.tenant = { name: { contains: String(value), mode: 'insensitive' } };
      else if (key === 'status') where.status = value;
      else if (key === 'payment_condition') where.payment_condition = value;
    });

    const [leases, properties, propertyTypes, owners, tenants, dateRange] = await Promise.all([
      prisma.lease.findMany({ where: where as never, select: { contract_number: true, rent_amount: true, rent_due_day: true } }),
      prisma.property.findMany({ where: { deleted_at: null, leases: { some: where as never } }, select: { id: true, title: true }, orderBy: { title: 'asc' }, distinct: ['title'] }),
      prisma.propertyType.findMany({ where: { deleted_at: null, properties: { some: { deleted_at: null, leases: { some: where as never } } } }, select: { id: true, description: true }, orderBy: { description: 'asc' }, distinct: ['description'] }),
      prisma.owner.findMany({ where: { deleted_at: null, leases: { some: where as never } }, select: { id: true, name: true }, orderBy: { name: 'asc' }, distinct: ['name'] }),
      prisma.tenant.findMany({ where: { deleted_at: null, leases: { some: where as never } }, select: { id: true, name: true }, orderBy: { name: 'asc' }, distinct: ['name'] }),
      prisma.lease.aggregate({ where: where as never, _min: { created_at: true }, _max: { created_at: true } }),
    ]);

    const uniq = (arr: (string | null | undefined)[]) => [...new Set(arr.filter(Boolean).map((v) => String(v).trim()))].sort();
    const uniqNum = (arr: (number | null)[]) => [...new Set(arr.filter((v) => v !== null).map((v) => String(v)))].sort((a, b) => Number(a) - Number(b));

    return {
      filters: [
        { field: 'contract_number', type: 'string', label: 'Número do Contrato', values: uniq(leases.map((l) => l.contract_number)), searchable: true, autocomplete: true },
        {
          field: 'status',
          type: 'select',
          label: 'Status',
          multiple: true,
          values: [
            { value: 'ACTIVE', label: 'Ativo' },
            { value: 'EXPIRING', label: 'A Vencer (em 30 dias)' },
            { value: 'EXPIRED', label: 'Expirado / Vencido' },
            { value: 'CANCELED', label: 'Cancelado' },
          ],
          searchable: false,
          autocomplete: false,
        },
        {
          field: 'payment_condition',
          type: 'select',
          label: 'Condição de Pagamento',
          multiple: true,
          values: [
            { value: 'IN_FULL_15_DISCOUNT', label: 'À vista c/ 15% desc.' },
            { value: 'SECOND_INSTALLMENT_10_DISCOUNT', label: '2 parcelas c/ 10% desc.' },
            { value: 'INSTALLMENTS', label: 'Parcelado' },
          ],
          searchable: false,
          autocomplete: false,
        },
        { field: 'start_date', type: 'date', label: 'Data de Início', dateRange: true },
        { field: 'end_date', type: 'date', label: 'Data de Término', dateRange: true },
        { field: 'rent_amount', type: 'number', label: 'Valor do Aluguel', values: uniqNum(leases.map((l) => Number(l.rent_amount))), searchable: true },
        { field: 'condo_fee', type: 'number', label: 'Valor do Condomínio', searchable: true },
        { field: 'property_tax', type: 'number', label: 'Valor do IPTU Base', searchable: true },
        { field: 'extra_charges', type: 'number', label: 'Taxas Extras', searchable: true },
        { field: 'discount_amount', type: 'number', label: 'Desconto / Despesa', searchable: true },
        { field: 'commission_amount', type: 'number', label: 'Comissão', searchable: true },
        { field: 'rent_due_day', type: 'number', label: 'Dia de Vencimento do Aluguel', values: uniqNum(leases.map((l) => l.rent_due_day)), searchable: true },
        { field: 'tax_due_day', type: 'number', label: 'Dia de Vencimento do IPTU', searchable: true },
        { field: 'condo_due_day', type: 'number', label: 'Dia de Vencimento do Condomínio', searchable: true },
        { field: 'property_title', type: 'string', label: 'Propriedade', values: uniq(properties.map((p) => p.title)), searchable: true, autocomplete: true },
        { field: 'type_description', type: 'string', label: 'Tipo de Propriedade', values: uniq(propertyTypes.map((t) => t.description)), searchable: true, autocomplete: true },
        { field: 'owner_name', type: 'string', label: 'Proprietário', values: uniq(owners.map((o) => o.name)), searchable: true, autocomplete: true },
        { field: 'tenant_name', type: 'string', label: 'Inquilino', values: uniq(tenants.map((t) => t.name)), searchable: true, autocomplete: true },
        { field: 'created_at', type: 'date', label: 'Criado em', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true },
      ],
      operators: { string: ['contains', 'equals', 'startsWith', 'endsWith'], number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'], date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'], boolean: ['equals'], select: ['equals', 'in'] },
      defaultSort: 'created_at:desc',
      searchFields: ['contract_number', 'property.title', 'owner.name', 'tenant.name', 'property.type.description', 'status', 'payment_condition'],
    };
  }

  async findById(id: string): Promise<Lease | null> {
    const lease = await prisma.lease.findFirst({ where: { id, deleted_at: null }, include: DETAIL_INCLUDE });
    if (!lease) return null;
    return serializeLease(processLeaseStatus(lease)) as unknown as Lease;
  }

  async contractNumberExists(contractNumber: string): Promise<boolean> {
    return !!(await prisma.lease.findFirst({ where: { contract_number: contractNumber, deleted_at: null }, select: { id: true } }));
  }
  async contractNumberExistsExcept(contractNumber: string, exceptId: string): Promise<boolean> {
    return !!(await prisma.lease.findFirst({ where: { contract_number: contractNumber, deleted_at: null, NOT: { id: exceptId } }, select: { id: true } }));
  }
  async getPropertyCategoryId(propertyId: string): Promise<string | null> {
    const property = await prisma.property.findFirst({ where: { id: propertyId, deleted_at: null }, select: { category_id: true } });
    return property?.category_id ?? null;
  }

  async create(data: CreateLeaseData): Promise<Lease> {
    // `tx` (dentro de $transaction) não passa pela extensão multi-tenant —
    // company_id precisa ser injetado explicitamente.
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Contexto de empresa não identificado.');

    const created = await prisma.$transaction(async (tx: any) => {
      const calculatedStatus = data.status === 'CANCELED' ? 'CANCELED' : determineStatus(new Date(data.end_date));

      const newLease = await tx.lease.create({
        data: {
          company_id: companyId,
          ...buildLeaseData(data),
          status: calculatedStatus,
          canceled_at: calculatedStatus === 'CANCELED' ? (data.canceled_at ? new Date(data.canceled_at) : new Date()) : null,
        },
      });

      // Se criou e está ativa/expirando, garante que o imóvel fique OCUPADO.
      const propertyValue = await tx.propertyValue.findFirst({ where: { property_id: data.property_id, deleted_at: null }, orderBy: { created_at: 'desc' } });
      if (propertyValue && propertyValue.status !== 'OCCUPIED' && calculatedStatus !== 'CANCELED') {
        await tx.propertyValue.update({ where: { id: propertyValue.id }, data: { status: 'OCCUPIED' } });
      }

      return newLease;
    });

    // Retorna o registro cru (create), como no backend — quem precisa das
    // relations completas usa findById.
    return serializeLease(created) as unknown as Lease;
  }

  async update(id: string, data: UpdateLeaseData): Promise<Lease> {
    const updated = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.lease.findUnique({ where: { id, deleted_at: null } });
      if (!existing) throw new Error('Lease not found');

      const calculatedStatus = data.status === 'CANCELED' ? 'CANCELED' : determineStatus(new Date(data.end_date || existing.end_date));

      const updatedLease = await tx.lease.update({
        where: { id },
        data: {
          ...buildLeaseData(data, existing),
          status: calculatedStatus,
          canceled_at: calculatedStatus === 'CANCELED' && existing.status !== 'CANCELED'
            ? new Date(data.canceled_at || new Date())
            : (calculatedStatus === 'CANCELED' ? existing.canceled_at : null),
        },
      });

      const targetPropertyId = data.property_id ?? existing.property_id;
      const propertyValue = await tx.propertyValue.findFirst({ where: { property_id: targetPropertyId, deleted_at: null }, orderBy: { created_at: 'desc' } });

      if (propertyValue) {
        if (calculatedStatus !== 'CANCELED' && propertyValue.status !== 'OCCUPIED') {
          await tx.propertyValue.update({ where: { id: propertyValue.id }, data: { status: 'OCCUPIED' } });
        } else if (calculatedStatus === 'CANCELED' && propertyValue.status === 'OCCUPIED') {
          const activeLeases = await tx.lease.count({ where: { property_id: targetPropertyId, NOT: { id: updatedLease.id }, deleted_at: null, status: { not: 'CANCELED' } } });
          if (activeLeases === 0) {
            await tx.propertyValue.update({ where: { id: propertyValue.id }, data: { status: 'AVAILABLE' } });
          }
        }
      }

      return updatedLease;
    });

    return serializeLease(updated) as unknown as Lease;
  }

  async softDelete(id: string): Promise<Lease | null> {
    const existing = await prisma.lease.findFirst({ where: { id, deleted_at: null } });
    if (!existing) return null;

    const result = await prisma.$transaction(async (tx: any) => {
      const deletedLease = await tx.lease.update({
        where: { id },
        data: { deleted_at: new Date(), status: 'CANCELED', canceled_at: existing.canceled_at || new Date() },
      });

      const propertyValue = await tx.propertyValue.findFirst({ where: { property_id: existing.property_id, deleted_at: null }, orderBy: { created_at: 'desc' } });
      if (propertyValue && propertyValue.status === 'OCCUPIED') {
        const activeLeases = await tx.lease.count({ where: { property_id: existing.property_id, NOT: { id }, deleted_at: null, status: { not: 'CANCELED' } } });
        if (activeLeases === 0) {
          await tx.propertyValue.update({ where: { id: propertyValue.id }, data: { status: 'AVAILABLE' } });
        }
      }
      return deletedLease;
    });

    return serializeLease(result) as unknown as Lease;
  }

  async permanentlyDelete(id: string): Promise<Lease | null> {
    const existing = await prisma.lease.findFirst({ where: { id } });
    if (!existing) return null;

    const result = await prisma.$transaction(async (tx: any) => {
      // Cascata: remove os lançamentos financeiros gerados por esta locação.
      await tx.transaction.deleteMany({ where: { lease_id: id } });
      await tx.lease.delete({ where: { id } });

      const propertyValue = await tx.propertyValue.findFirst({ where: { property_id: existing.property_id, deleted_at: null }, orderBy: { created_at: 'desc' } });
      if (propertyValue && propertyValue.status === 'OCCUPIED') {
        const activeLeases = await tx.lease.count({ where: { property_id: existing.property_id, NOT: { id }, deleted_at: null, status: { not: 'CANCELED' } } });
        if (activeLeases === 0) {
          await tx.propertyValue.update({ where: { id: propertyValue.id }, data: { status: 'AVAILABLE' } });
        }
      }
      return existing;
    });

    return serializeLease(result) as unknown as Lease;
  }

  async restore(id: string): Promise<Lease | null> {
    const existing = await prisma.lease.findFirst({ where: { id } });
    if (!existing) return null;

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedLease = await tx.lease.update({
        where: { id },
        data: { status: determineStatus(existing.end_date), canceled_at: null, cancellation_penalty: null, other_cancellation_amounts: null, cancellation_justification: null },
      });

      // Como restaurou a locação, garante que o imóvel fique OCUPADO.
      const propertyValue = await tx.propertyValue.findFirst({ where: { property_id: existing.property_id, deleted_at: null }, orderBy: { created_at: 'desc' } });
      if (propertyValue && propertyValue.status !== 'OCCUPIED') {
        await tx.propertyValue.update({ where: { id: propertyValue.id }, data: { status: 'OCCUPIED' } });
      }
      return updatedLease;
    });

    return serializeLease(result) as unknown as Lease;
  }

  async getCancellationPreview(id: string, date: string): Promise<CancellationPreview | null> {
    const lease = await prisma.lease.findFirst({ where: { id, deleted_at: null } });
    if (!lease) return null;

    const from = parseLocalDate(date);
    const to = lease.end_date;

    // Lançamentos da locação com efetivação entre a data do cancelamento e o
    // término. Encargos de cancelamento e já excluídos não entram.
    const transactions = await prisma.transaction.findMany({
      where: { lease_id: id, deleted_at: null, is_cancellation_charge: false, effective_date: { gte: from, lte: to } },
      orderBy: { effective_date: 'asc' },
      include: { category: true, center: true },
    });

    return {
      lease: { id: lease.id, contract_number: lease.contract_number, start_date: lease.start_date, end_date: lease.end_date },
      from,
      to,
      transactions,
    };
  }

  async cancel(id: string, input: CancelLeaseInput, companyId: string): Promise<CancelLeaseResult | null> {
    return prisma.$transaction(async (tx: any) => {
      const existing = await tx.lease.findFirst({ where: { id, company_id: companyId, deleted_at: null } });
      if (!existing) return null;

      const canceledAt = input.date ? new Date(input.date) : new Date();

      // 1. Soft-delete dos lançamentos confirmados (restritos a esta locação/empresa).
      const ids = Array.isArray(input.transactionIds) ? input.transactionIds.map(String) : [];
      let deletedCount = 0;
      if (ids.length > 0) {
        const result = await tx.transaction.updateMany({
          where: { id: { in: ids }, lease_id: id, company_id: companyId, deleted_at: null },
          data: { deleted_at: new Date() },
        });
        deletedCount = result.count;
      }

      // 2. Encargo opcional (custas/juros/multas) → 1 lançamento de receita.
      let charge = null;
      const chargeInput = input.charge;
      if (chargeInput && Number(chargeInput.amount) > 0) {
        if (!chargeInput.category_id) throw new Error('Categoria do encargo é obrigatória.');
        if (!chargeInput.financial_institution_id) throw new Error('Conta do encargo é obrigatória.');

        const parseFK = (val: unknown) => (val === '' || val === 'null' || !val ? null : val);
        const chargeDate = parseLocalDate((chargeInput.date || input.date) as string);
        charge = await tx.transaction.create({
          data: {
            event_date: chargeDate,
            effective_date: chargeDate,
            description: chargeInput.description || `Encargo de cancelamento - Contrato ${existing.contract_number}`,
            amount: Number(chargeInput.amount),
            status: chargeInput.status || 'PENDING',
            category_id: chargeInput.category_id,
            subcategory_id: parseFK(chargeInput.subcategory_id),
            financial_institution_id: chargeInput.financial_institution_id,
            center_id: parseFK(chargeInput.center_id),
            supplier_id: parseFK(chargeInput.supplier_id),
            lease_id: id,
            is_cancellation_charge: true,
            company_id: companyId,
          },
        });
      }

      // 3. Marca a locação como cancelada.
      const updated = await tx.lease.update({
        where: { id },
        data: {
          status: 'CANCELED',
          canceled_at: canceledAt,
          cancellation_justification: input.reason ?? existing.cancellation_justification,
          cancellation_penalty: charge ? Number(charge.amount) : existing.cancellation_penalty,
        },
      });

      // 4. Libera o imóvel se não houver outra locação ativa.
      const propertyValue = await tx.propertyValue.findFirst({ where: { property_id: existing.property_id, deleted_at: null }, orderBy: { created_at: 'desc' } });
      if (propertyValue && propertyValue.status === 'OCCUPIED') {
        const activeLeases = await tx.lease.count({ where: { property_id: existing.property_id, NOT: { id }, deleted_at: null, status: { not: 'CANCELED' } } });
        if (activeLeases === 0) {
          await tx.propertyValue.update({ where: { id: propertyValue.id }, data: { status: 'AVAILABLE' } });
        }
      }

      // `Transaction.amount` também é `@db.Decimal` — mesma serialização necessária.
      const serializedCharge = charge ? { ...charge, amount: Number(charge.amount) } : charge;
      return { lease: serializeLease(updated) as unknown as Lease, deleted: deletedCount, charge: serializedCharge };
    });
  }

  async exists(id: string): Promise<boolean> {
    return !!(await prisma.lease.findFirst({ where: { id, deleted_at: null }, select: { id: true } }));
  }

  async removeDocuments(leaseId: string, documentIds: string[]): Promise<void> {
    if (!documentIds || documentIds.length === 0) return;
    // Restringe por lease_id (o filtro de empresa vem do contexto no findMany).
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, lease_id: leaseId, deleted_at: null },
      select: { id: true },
    });
    if (documents.length === 0) return;
    await prisma.document.updateMany({
      where: { id: { in: documents.map((d) => d.id) } },
      data: { deleted_at: new Date() },
    });
  }

  async createDocuments(
    leaseId: string,
    documents: Array<{ url: string; mimetype: string; description: string; createdBy: string | null }>,
  ): Promise<void> {
    // `company_id` explícito — não depende só da extensão de tenant, que em
    // ambiente de dev (Turbopack) pode rodar fora do AsyncLocalStorage.
    const lease = await prisma.lease.findFirst({ where: { id: leaseId }, select: { company_id: true } });
    if (!lease) throw new Error('Locação não encontrada ao criar documento.');

    for (const doc of documents) {
      await prisma.document.create({
        data: {
          company_id: lease.company_id,
          lease_id: leaseId,
          file_path: doc.url,
          file_type: doc.mimetype,
          description: doc.description,
          type: 'LEASE_CONTRACT',
          created_by: doc.createdBy,
        } as never,
      });
    }
  }
}
