import { releaseExpiredProperties } from './property-occupancy';
import prisma from '@/infra/database/prisma';
import { resolveLocation, type LocationAddress } from '@/shared/utils/property-location';
import { buildDateTimeCondition } from '@/shared/utils/date-utils';
import type { PropertiesRepository } from '@/core/repositories/properties-repository';
import type {
  CreateUnifiedPropertyData,
  ListPropertiesParams,
  PaginatedProperties,
  Property,
  UpdateUnifiedPropertyData,
} from '@/core/entities/property';

/**
 * Implementação Prisma de {@link PropertiesRepository}.
 * Porte de api-nairim-v2/src/services/PropertyService.ts (escopo: fluxo unificado).
 *
 * Tenant-scoped: `Property` está em TENANT_MODELS. `Address`/`PropertyAddress`/
 * `PropertyValue`/`PropertyIptu`/`Document` não são tenant-scoped diretamente
 * (ligados via FK a `property_id`), igual ao backend.
 *
 * Camada: infra.
 */

const DIRECT_FIELDS = ['title', 'bedrooms', 'bathrooms', 'half_bathrooms', 'garage_spaces', 'area_total', 'area_built', 'frontage', 'furnished', 'income_tax_withholding', 'floor_number', 'tax_registration', 'notes', 'created_at', 'updated_at'];
const RELATION_FIELD_MAP: Record<string, { type: 'relation' | 'address'; relationPath: string }> = {
  owner_name: { type: 'relation', relationPath: 'owner.name' },
  type_description: { type: 'relation', relationPath: 'type.description' },
  agency_trade_name: { type: 'relation', relationPath: 'agency.trade_name' },
  status: { type: 'relation', relationPath: 'values.0.status' },
  city: { type: 'address', relationPath: 'addresses.0.address.city' },
  state: { type: 'address', relationPath: 'addresses.0.address.state' },
  district: { type: 'address', relationPath: 'addresses.0.address.district' },
  street: { type: 'address', relationPath: 'addresses.0.address.street' },
  zip_code: { type: 'address', relationPath: 'addresses.0.address.zip_code' },
};

const LIST_INCLUDE = {
  addresses: { where: { deleted_at: null }, include: { address: true } },
  owner: { select: { id: true, name: true, internal_code: true } },
  type: { select: { id: true, description: true } },
  agency: { select: { id: true, trade_name: true } },
  center: { select: { id: true, name: true } },
  debit_center: { select: { id: true, name: true } },
  documents: { where: { deleted_at: null } },
  values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' as const } },
  iptus: { orderBy: { year: 'desc' as const } },
  leases: { where: { deleted_at: null }, take: 1, orderBy: { created_at: 'desc' as const }, include: { tenant: true, owner: true } },
  favorites: { where: { deleted_at: null }, include: { user: true } },
};

const DETAIL_INCLUDE = {
  addresses: { where: { deleted_at: null }, include: { address: true } },
  owner: true,
  type: true,
  documents: { where: { deleted_at: null } },
  values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' as const } },
  iptus: { orderBy: { year: 'desc' as const } },
  agency: true,
  center: true,
  debit_center: true,
  category: true,
  subcategory: true,
  leases: { where: { deleted_at: null }, include: { tenant: true, owner: true } },
  favorites: { where: { deleted_at: null }, include: { user: true } },
};

/**
 * ⚠️ Achado em teste E2E (2026-08-13): `PropertyValue.purchase_value`,
 * `market_value`, `rental_value` e `condo_fee` são `@db.Decimal` no schema —
 * o Prisma retorna instâncias de `Decimal` (classe com métodos), não `number`
 * puro. Passar isso direto para um Client Component quebra o boundary RSC
 * ("Only plain objects can be passed to Client Components from Server
 * Components... Decimal objects are not supported"), reproduzível em
 * qualquer tela que carregue uma lista de imóveis com `values` incluído.
 * `list()`/`findById()` faziam cast puro (`as Property[]`/`as unknown as
 * Property`) sem converter — corrigido aqui convertendo os Decimal para
 * `number` antes de devolver, análogo ao que `buildValueData` já fazia para
 * o sentido inverso (input → Prisma).
 */
function serializePropertyValues(values: any[] | undefined): any[] {
  if (!values) return values as never;
  return values.map((v) => ({
    ...v,
    purchase_value: v.purchase_value != null ? Number(v.purchase_value) : v.purchase_value,
    market_value: v.market_value != null ? Number(v.market_value) : v.market_value,
    rental_value: v.rental_value != null ? Number(v.rental_value) : v.rental_value,
    condo_fee: v.condo_fee != null ? Number(v.condo_fee) : v.condo_fee,
    property_tax: v.property_tax != null ? Number(v.property_tax) : v.property_tax,
    sale_value: v.sale_value != null ? Number(v.sale_value) : v.sale_value,
    extra_charges: v.extra_charges != null ? Number(v.extra_charges) : v.extra_charges,
  }));
}

/** Mesmo problema de `serializePropertyValues`, mas para `PropertyIptu` (4 campos Decimal). */
function serializePropertyIptus(iptus: any[] | undefined): any[] {
  if (!iptus) return iptus as never;
  return iptus.map((i) => ({
    ...i,
    property_tax: i.property_tax != null ? Number(i.property_tax) : i.property_tax,
    property_tax_cash: i.property_tax_cash != null ? Number(i.property_tax_cash) : i.property_tax_cash,
    property_tax_first_installment: i.property_tax_first_installment != null ? Number(i.property_tax_first_installment) : i.property_tax_first_installment,
    property_tax_second_installment: i.property_tax_second_installment != null ? Number(i.property_tax_second_installment) : i.property_tax_second_installment,
  }));
}

/**
 * Mesmo problema, mas para `Lease` (`LIST_INCLUDE`/`DETAIL_INCLUDE` trazem o
 * registro completo — 11 campos Decimal, mesma lista de
 * `serializeLease` em `prisma-leases-repository.ts`; duplicado aqui em vez de
 * exportado para não acoplar os dois repositórios entre si).
 */
function serializePropertyLeases(leases: any[] | undefined): any[] {
  if (!leases) return leases as never;
  return leases.map((l) => ({
    ...l,
    rent_amount: l.rent_amount != null ? Number(l.rent_amount) : l.rent_amount,
    condo_fee: l.condo_fee != null ? Number(l.condo_fee) : l.condo_fee,
    property_tax: l.property_tax != null ? Number(l.property_tax) : l.property_tax,
    extra_charges: l.extra_charges != null ? Number(l.extra_charges) : l.extra_charges,
    commission_amount: l.commission_amount != null ? Number(l.commission_amount) : l.commission_amount,
    agency_commission: l.agency_commission != null ? Number(l.agency_commission) : l.agency_commission,
    cancellation_penalty: l.cancellation_penalty != null ? Number(l.cancellation_penalty) : l.cancellation_penalty,
    other_cancellation_amounts: l.other_cancellation_amounts != null ? Number(l.other_cancellation_amounts) : l.other_cancellation_amounts,
    property_tax_cash: l.property_tax_cash != null ? Number(l.property_tax_cash) : l.property_tax_cash,
    property_tax_first_installment: l.property_tax_first_installment != null ? Number(l.property_tax_first_installment) : l.property_tax_first_installment,
    property_tax_second_installment: l.property_tax_second_installment != null ? Number(l.property_tax_second_installment) : l.property_tax_second_installment,
  }));
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[çÇ]/g, 'c').replace(/[ñÑ]/g, 'n').toLowerCase().trim();
}

function normalizeDirection(direction: string): 'asc' | 'desc' {
  return String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function safeGet(obj: any, path: string): unknown {
  return path.split('.').reduce((acc: any, part) => (acc === null || acc === undefined ? undefined : acc[part]), obj);
}

/** Filtros de WHERE — `status` (disponibilidade) NÃO entra aqui, é aplicado em memória sobre values[0]. */
function buildFilterConditions(filters: Record<string, unknown>): Record<string, any> {
  const conditions: Record<string, any> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (['owner_id', 'type_id', 'agency_id', 'center_id'].includes(key)) {
      conditions[key] = value;
    } else if (key === 'furnished' || key === 'income_tax_withholding') {
      conditions[key] = typeof value === 'string' ? value.toLowerCase() === 'true' : Boolean(value);
    } else if (['bedrooms', 'bathrooms', 'half_bathrooms', 'garage_spaces', 'floor_number'].includes(key)) {
      const n = parseInt(String(value));
      if (!isNaN(n)) conditions[key] = n;
    } else if (['area_total', 'area_built', 'frontage'].includes(key)) {
      const n = parseFloat(String(value));
      if (!isNaN(n)) conditions[key] = n;
    } else if (['title', 'tax_registration', 'notes'].includes(key)) {
      conditions[key] = { contains: String(value), mode: 'insensitive' };
    } else if (['city', 'state', 'district', 'street', 'zip_code'].includes(key)) {
      if (!conditions.addresses) conditions.addresses = { some: { address: {} } };
      conditions.addresses.some.address[key] = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'created_at') {
      conditions.created_at = buildDateTimeCondition(value);
    }
  });
  return conditions;
}

function buildWhere(filters: Record<string, unknown>, includeInactive: boolean): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!includeInactive) where.deleted_at = null;
  const conditions = buildFilterConditions(filters);
  if (Object.keys(conditions).length > 0) where.AND = [conditions];
  return where;
}

function buildOrderBy(sortOptions: Record<string, string>): Record<string, unknown>[] {
  const orderBy: Record<string, unknown>[] = [];
  Object.entries(sortOptions).forEach(([field, direction]) => {
    const dir = normalizeDirection(direction);
    if (field === 'owner.name' || field === 'owner_name') orderBy.push({ owner: { name: dir } });
    else if (field === 'type.description' || field === 'type_description') orderBy.push({ type: { description: dir } });
    else if (field === 'agency.trade_name' || field === 'agency_trade_name') orderBy.push({ agency: { trade_name: dir } });
    else if (DIRECT_FIELDS.includes(field)) orderBy.push({ [field]: dir });
  });
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
  return orderBy;
}

function filterBySearch(properties: any[], searchTerm: string): any[] {
  if (!searchTerm.trim()) return properties;
  const normalized = normalizeText(searchTerm);
  return properties.filter((p) => {
    const direct = [p.title, p.tax_registration, p.notes].filter(Boolean).join(' ');
    const ownerFields = p.owner ? [p.owner.name, p.owner.internal_code].filter(Boolean).join(' ') : '';
    const typeFields = p.type ? [p.type.description].filter(Boolean).join(' ') : '';
    const agencyFields = p.agency ? [p.agency.trade_name].filter(Boolean).join(' ') : '';
    const addressFields = (p.addresses ?? [])
      .map((pa: any) => pa.address).filter(Boolean)
      .map((a: any) => [a.street, a.district, a.city, a.state, a.zip_code].filter(Boolean).join(' ')).join(' ');
    return normalizeText([direct, ownerFields, typeFields, agencyFields, addressFields].join(' ')).includes(normalized);
  });
}

function sortByDirectField(items: any[], field: string, direction: 'asc' | 'desc'): any[] {
  return [...items].sort((a, b) => {
    const valueA = a[field] ?? '';
    const valueB = b[field] ?? '';
    if (['title', 'tax_registration', 'notes'].includes(field)) {
      const strA = normalizeText(String(valueA));
      const strB = normalizeText(String(valueB));
      return direction === 'asc' ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' }) : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
    }
    if (direction === 'asc') return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
  });
}

function sortByRelatedField(items: any[], field: string, direction: 'asc' | 'desc'): any[] {
  const info = RELATION_FIELD_MAP[field];
  if (!info) return items;
  return [...items].sort((a, b) => {
    const strA = normalizeText(String(safeGet(a, info.relationPath) ?? ''));
    const strB = normalizeText(String(safeGet(b, info.relationPath) ?? ''));
    return direction === 'asc' ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' }) : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
  });
}

/** Ordena documentos: destacado primeiro, depois vídeos, depois mais recentes. */
function sortPropertyDocuments(documents: any[]): any[] {
  if (!documents || !Array.isArray(documents)) return documents;
  return [...documents].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    const aVideo = typeof a.file_type === 'string' && a.file_type.includes('video');
    const bVideo = typeof b.file_type === 'string' && b.file_type.includes('video');
    if (aVideo && !bVideo) return -1;
    if (!aVideo && bVideo) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function buildAddressCreateData(address: NonNullable<CreateUnifiedPropertyData['address']>, previous?: LocationAddress) {
  return {
    zip_code: address.zip_code,
    street: address.street,
    number: address.number,
    complement: address.complement || null,
    block: address.block || null,
    lot: address.lot || null,
    district: address.district,
    city: address.city,
    state: address.state,
    country: address.country || 'Brasil',
    ...resolveLocation(address, previous),
  };
}

function buildValueData(values: NonNullable<CreateUnifiedPropertyData['values']>) {
  return {
    purchase_value: values.purchase_value != null && (values.purchase_value as unknown) !== '' ? Number(values.purchase_value) : null,
    purchase_date: values.purchase_date ? new Date(values.purchase_date) : null,
    market_value: values.market_value != null && (values.market_value as unknown) !== '' ? Number(values.market_value) : null,
    rental_value: values.rental_value != null && (values.rental_value as unknown) !== '' ? Number(values.rental_value) : null,
    condo_fee: values.condo_fee != null && (values.condo_fee as unknown) !== '' ? Number(values.condo_fee) : null,
    property_tax: Number(values.property_tax || 0),
    status: (values.status as never) || 'AVAILABLE',
    notes: values.notes,
    sale_value: Number(values.sale_value || 0),
    extra_charges: Number(values.extra_charges || 0),
    sale_date: values.sale_date ? new Date(values.sale_date) : null,
  };
}

function buildIptuData(iptu: NonNullable<CreateUnifiedPropertyData['iptus']>[number]) {
  return {
    property_tax: iptu.property_tax ? Number(iptu.property_tax) : null,
    property_tax_cash: iptu.property_tax_cash ? Number(iptu.property_tax_cash) : null,
    property_tax_cash_due_date: iptu.property_tax_cash_due_date ? new Date(iptu.property_tax_cash_due_date) : null,
    property_tax_first_installment: iptu.property_tax_first_installment ? Number(iptu.property_tax_first_installment) : null,
    property_tax_first_installment_due_date: iptu.property_tax_first_installment_due_date ? new Date(iptu.property_tax_first_installment_due_date) : null,
    property_tax_second_installment: iptu.property_tax_second_installment ? Number(iptu.property_tax_second_installment) : null,
    property_tax_second_installment_due_date: iptu.property_tax_second_installment_due_date ? new Date(iptu.property_tax_second_installment_due_date) : null,
    iptu_installments_count: iptu.iptu_installments_count ? Number(iptu.iptu_installments_count) : null,
    iptu_installments: iptu.iptu_installments ?? null,
    payment_condition: (iptu.payment_condition as never) || null,
  };
}

export class PrismaPropertiesRepository implements PropertiesRepository {
  async list(params: ListPropertiesParams): Promise<PaginatedProperties> {
    await releaseExpiredProperties(prisma);
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;

    const statusFilter = params.filters?.status ? String(params.filters.status) : '';
    const restFilters = { ...params.filters };
    delete restFilters.status;
    const where = buildWhere(restFilters, params.includeInactive);

    const sortEntries = Object.entries(params.sortOptions);
    const sortField = sortEntries[0]?.[0] ?? '';
    const sortDirection = sortEntries[0] ? normalizeDirection(sortEntries[0][1]) : 'asc';
    const sortFieldIsDirect = DIRECT_FIELDS.includes(sortField);

    let properties: any[] = [];
    let total = 0;

    if (params.search?.trim() || statusFilter || (sortField && !sortFieldIsDirect && RELATION_FIELD_MAP[sortField])) {
      const all = await prisma.property.findMany({ where: where as never, include: LIST_INCLUDE });
      let filtered = params.search?.trim() ? filterBySearch(all, params.search) : all;

      if (statusFilter) {
        filtered = filtered.filter((p) => (p.values?.[0]?.status ?? 'AVAILABLE') === statusFilter);
      }
      total = filtered.length;

      if (sortField) {
        properties = !sortFieldIsDirect && RELATION_FIELD_MAP[sortField]
          ? sortByRelatedField(filtered, sortField, sortDirection)
          : sortByDirectField(filtered, sortField, sortDirection);
      } else {
        properties = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      properties = properties.slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.property.findMany({ where: where as never, skip, take, orderBy: buildOrderBy(params.sortOptions) as never, include: LIST_INCLUDE }),
        prisma.property.count({ where: where as never }),
      ]);
      properties = data;
      total = count;
    }

    properties.forEach((p) => {
      if (p.documents) p.documents = sortPropertyDocuments(p.documents);
      if (p.values) p.values = serializePropertyValues(p.values);
      if (p.iptus) p.iptus = serializePropertyIptus(p.iptus);
      if (p.leases) p.leases = serializePropertyLeases(p.leases);
    });

    return { data: properties as Property[], count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    const where = buildWhere(filters ?? {}, false) as Record<string, any>;

    const [properties, owners, propertyTypes, agencies, centers, addresses, dateRange] = await Promise.all([
      prisma.property.findMany({ where: where as never, select: { title: true, bedrooms: true, bathrooms: true, garage_spaces: true, tax_registration: true, notes: true } }),
      prisma.owner.findMany({ where: { deleted_at: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.propertyType.findMany({ where: { deleted_at: null }, select: { id: true, description: true }, orderBy: { description: 'asc' } }),
      prisma.agency.findMany({ where: { deleted_at: null }, select: { id: true, trade_name: true }, orderBy: { trade_name: 'asc' } }),
      prisma.center.findMany({ where: { deleted_at: null, is_active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.address.findMany({
        where: { deleted_at: null, propertyAddresses: { some: { property: { deleted_at: null } } } },
        select: { city: true, state: true, district: true, street: true, zip_code: true },
        distinct: ['city', 'state', 'district', 'street', 'zip_code'],
      }),
      prisma.property.aggregate({ where: where as never, _min: { created_at: true }, _max: { created_at: true } }),
    ]);

    const uniq = (arr: (string | null | undefined)[]) => [...new Set(arr.filter(Boolean).map((v) => String(v).trim()))].sort();
    const uniqNum = (arr: (number | null)[]) => [...new Set(arr.filter((v) => v !== null).map((v) => String(v)))].sort((a, b) => Number(a) - Number(b));

    return {
      filters: [
        { field: 'title', type: 'string', label: 'Título', description: 'Título da propriedade', values: uniq(properties.map((p) => p.title)), searchable: true, autocomplete: true },
        { field: 'bedrooms', type: 'number', label: 'Quartos', description: 'Número de quartos', values: uniqNum(properties.map((p) => p.bedrooms)), searchable: true },
        { field: 'bathrooms', type: 'number', label: 'Banheiros', description: 'Número de banheiros', values: uniqNum(properties.map((p) => p.bathrooms)), searchable: true },
        { field: 'garage_spaces', type: 'number', label: 'Vagas na Garagem', description: 'Número de vagas na garagem', values: uniqNum(properties.map((p) => p.garage_spaces)), searchable: true },
        { field: 'status', type: 'select', label: 'Disponibilidade', description: 'Status de ocupação do imóvel', options: [{ value: 'AVAILABLE', label: 'Disponível' }, { value: 'OCCUPIED', label: 'Ocupado' }], searchable: false },
        // Rótulos em PT-BR: o seletor exibia "true"/"false" cru (Tarefa 1.4).
        { field: 'furnished', type: 'select', label: 'Mobiliado', description: 'Propriedade mobiliada', options: [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }], searchable: false },
        { field: 'income_tax_withholding', type: 'select', label: 'IRRF', description: 'Imóvel com Imposto de Renda Retido na Fonte', options: [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }], searchable: false },
        { field: 'tax_registration', type: 'string', label: 'Inscrição fiscal', description: 'Inscrição fiscal da propriedade', values: uniq(properties.map((p) => p.tax_registration)), searchable: true, autocomplete: true },
        { field: 'owner_id', type: 'select', label: 'Proprietário', description: 'Proprietário da propriedade', options: owners.map((o) => ({ value: o.id, label: o.name })), searchable: true },
        { field: 'type_id', type: 'select', label: 'Tipo do imóvel', description: 'Tipo da propriedade', options: propertyTypes.map((t) => ({ value: t.id, label: t.description })), searchable: true },
        { field: 'agency_id', type: 'select', label: 'Imobiliária', description: 'Agência responsável', options: agencies.map((a) => ({ value: a.id, label: a.trade_name })), searchable: true },
        { field: 'center_id', type: 'select', label: 'Centro de Custo', description: 'Centro de custo do imóvel', options: centers.map((c) => ({ value: c.id, label: c.name })), searchable: true },
        { field: 'city', type: 'string', label: 'Cidade', description: 'Cidade da propriedade', values: uniq(addresses.map((a) => a.city)), searchable: true, autocomplete: true },
        { field: 'state', type: 'string', label: 'Estado', description: 'Estado da propriedade', values: uniq(addresses.map((a) => a.state)), searchable: true, autocomplete: true },
        { field: 'district', type: 'string', label: 'Bairro', description: 'Bairro da propriedade', values: uniq(addresses.map((a) => a.district)), searchable: true, autocomplete: true },
        { field: 'street', type: 'string', label: 'Endereço', description: 'Endereço da propriedade', values: uniq(addresses.map((a) => a.street)), searchable: true, autocomplete: true },
        { field: 'zip_code', type: 'string', label: 'CEP', description: 'CEP da propriedade', values: uniq(addresses.map((a) => a.zip_code)), searchable: true, autocomplete: true },
        { field: 'created_at', type: 'date', label: 'Criado em', description: 'Data de criação do registro', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true },
      ],
      operators: {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        select: ['equals', 'in'],
      },
      defaultSort: 'created_at:desc',
      searchFields: ['title', 'tax_registration', 'notes', 'owner.name', 'type.description', 'agency.trade_name', 'address.city', 'address.state', 'address.district', 'address.street', 'address.zip_code', 'status'],
    };
  }

  async findById(id: string): Promise<Property | null> {
    await releaseExpiredProperties(prisma);
    const property = await prisma.property.findFirst({ where: { id, deleted_at: null }, include: DETAIL_INCLUDE });
    if (!property) return null;
    if ((property as any).documents) (property as any).documents = sortPropertyDocuments((property as any).documents);
    if ((property as any).values) (property as any).values = serializePropertyValues((property as any).values);
    if ((property as any).iptus) (property as any).iptus = serializePropertyIptus((property as any).iptus);
    if ((property as any).leases) (property as any).leases = serializePropertyLeases((property as any).leases);
    return property as unknown as Property;
  }

  async ownerExists(ownerId: string): Promise<boolean> {
    return !!(await prisma.owner.findFirst({ where: { id: ownerId, deleted_at: null }, select: { id: true } }));
  }
  async propertyTypeExists(typeId: string): Promise<boolean> {
    return !!(await prisma.propertyType.findFirst({ where: { id: typeId, deleted_at: null }, select: { id: true } }));
  }
  async agencyExists(agencyId: string): Promise<boolean> {
    return !!(await prisma.agency.findFirst({ where: { id: agencyId, deleted_at: null }, select: { id: true } }));
  }

  async create(data: CreateUnifiedPropertyData): Promise<Property> {
    const created = await prisma.$transaction(
      async (tx: any) => {
        // `company_id` é injetado pela extensão multi-tenant a partir do contexto.
        const property = await tx.property.create({
          data: {
            title: data.title,
            bedrooms: Number(data.bedrooms),
            bathrooms: Number(data.bathrooms),
            half_bathrooms: Number(data.half_bathrooms ?? 0),
            garage_spaces: Number(data.garage_spaces ?? 0),
            area_total: Number(data.area_total),
            area_built: data.area_built != null && (data.area_built as unknown) !== '' ? Number(data.area_built) : 0,
            frontage: data.frontage != null && (data.frontage as unknown) !== '' ? Number(data.frontage) : 0,
            furnished: Boolean(data.furnished),
            // Já normalizado para boolean em `createUnifiedPropertySchema`.
            income_tax_withholding: data.income_tax_withholding === true,
            floor_number: data.floor_number != null && (data.floor_number as unknown) !== '' ? Number(data.floor_number) : null,
            tax_registration: data.tax_registration,
            registration_number: data.registration_number || null,
            notes: data.notes,
            owner_id: data.owner_id,
            type_id: data.type_id,
            agency_id: data.agency_id || null,
            center_id: data.center_id || null,
            debit_center_id: data.debit_center_id || null,
            category_id: data.category_id || null,
            subcategory_id: data.subcategory_id || null,
            iptu_refund_category_id: data.iptu_refund_category_id || null,
            iptu_refund_subcategory_id: data.iptu_refund_subcategory_id || null,
          },
        });

        if (data.address) {
          const newAddress = await tx.address.create({ data: buildAddressCreateData(data.address) });
          await tx.propertyAddress.create({ data: { property_id: property.id, address_id: newAddress.id } });
        }

        if (data.values) {
          await tx.propertyValue.create({ data: { property_id: property.id, ...buildValueData(data.values) } });
        }

        if (data.iptus && Array.isArray(data.iptus)) {
          for (const iptu of data.iptus) {
            await tx.propertyIptu.create({ data: { property_id: property.id, year: Number(iptu.year), ...buildIptuData(iptu) } });
          }
        }

        return property;
      },
      { timeout: 10000 },
    );

    return (await this.findById(created.id))!;
  }

  async update(id: string, data: UpdateUnifiedPropertyData, removedDocumentIds: string[] = []): Promise<Property> {
    if (removedDocumentIds.length > 0) {
      await prisma.document.updateMany({ where: { id: { in: removedDocumentIds }, property_id: id }, data: { deleted_at: new Date() } });
    }

    await prisma.$transaction(
      async (tx: any) => {
        const existing = await tx.property.findUnique({ where: { id, deleted_at: null } });
        if (!existing) throw new Error('Propriedade não encontrada');

        const property = await tx.property.update({
          where: { id },
          data: {
            title: data.title,
            bedrooms: Number(data.bedrooms),
            bathrooms: Number(data.bathrooms),
            half_bathrooms: Number(data.half_bathrooms ?? 0),
            garage_spaces: Number(data.garage_spaces ?? 0),
            area_total: Number(data.area_total),
            area_built: data.area_built != null && (data.area_built as unknown) !== '' ? Number(data.area_built) : 0,
            frontage: data.frontage != null && (data.frontage as unknown) !== '' ? Number(data.frontage) : 0,
            furnished: Boolean(data.furnished),
            // Já normalizado para boolean em `createUnifiedPropertySchema`.
            income_tax_withholding: data.income_tax_withholding === true,
            floor_number: data.floor_number != null && (data.floor_number as unknown) !== '' ? Number(data.floor_number) : null,
            tax_registration: data.tax_registration,
            registration_number: data.registration_number || null,
            notes: data.notes,
            owner_id: data.owner_id,
            type_id: data.type_id,
            agency_id: data.agency_id || null,
            center_id: data.center_id || null,
            debit_center_id: data.debit_center_id || null,
            category_id: data.category_id || null,
            subcategory_id: data.subcategory_id || null,
            iptu_refund_category_id: data.iptu_refund_category_id || null,
            iptu_refund_subcategory_id: data.iptu_refund_subcategory_id || null,
          },
        });

        if (data.address) {
          const propertyAddress = await tx.propertyAddress.findFirst({ where: { property_id: id, deleted_at: null }, include: { address: true } });
          if (propertyAddress) {
            await tx.address.update({ where: { id: propertyAddress.address.id }, data: buildAddressCreateData(data.address, propertyAddress.address) });
          } else {
            const newAddress = await tx.address.create({ data: buildAddressCreateData(data.address) });
            await tx.propertyAddress.create({ data: { property_id: property.id, address_id: newAddress.id } });
          }
        }

        if (data.values) {
          const currentValue = await tx.propertyValue.findFirst({ where: { property_id: id, deleted_at: null } });
          const valueData = buildValueData(data.values);
          if (currentValue) {
            await tx.propertyValue.update({ where: { id: currentValue.id }, data: valueData });
          } else {
            await tx.propertyValue.create({ data: { property_id: property.id, ...valueData } });
          }
        }

        if (data.iptus && Array.isArray(data.iptus)) {
          const sentIds = data.iptus.filter((i) => i.id).map((i) => i.id);
          await tx.propertyIptu.deleteMany({ where: { property_id: property.id, ...(sentIds.length > 0 ? { id: { notIn: sentIds } } : {}) } });
          for (const iptu of data.iptus) {
            const iptuData = buildIptuData(iptu);
            if (iptu.id) {
              await tx.propertyIptu.update({ where: { id: iptu.id, property_id: property.id }, data: iptuData });
            } else {
              await tx.propertyIptu.create({ data: { property_id: property.id, year: Number(iptu.year), ...iptuData } });
            }
          }
        }

        return property;
      },
      { timeout: 10000 },
    );

    return (await this.findById(id))!;
  }

  async softDelete(id: string): Promise<Property | null> {
    const property = await prisma.property.findFirst({ where: { id, deleted_at: null } });
    if (!property) return null;
    await prisma.property.update({ where: { id }, data: { deleted_at: new Date() } });
    return property as unknown as Property;
  }

  async findDeletionState(id: string): Promise<{ title: string; deleted_at: Date | null } | null> {
    return prisma.property.findFirst({ where: { id }, select: { title: true, deleted_at: true } });
  }

  async restore(id: string): Promise<Property> {
    const property = await prisma.property.update({ where: { id }, data: { deleted_at: null } });
    return property as unknown as Property;
  }

  async createDocuments(
    propertyId: string,
    documents: Array<{ url: string; mimetype: string; type: string; description: string; createdBy: string | null }>,
    featuredIdentifier?: string,
  ): Promise<void> {
    const created: Array<{ id: string; url: string; description: string }> = [];

    // `company_id` explícito — não depende só da extensão de tenant, que em
    // ambiente de dev (Turbopack) pode rodar fora do AsyncLocalStorage.
    const property = await prisma.property.findFirst({ where: { id: propertyId }, select: { company_id: true } });
    if (!property) throw new Error('Imóvel não encontrado ao criar documento.');

    for (const doc of documents) {
      const record = await prisma.document.create({
        data: {
          company_id: property.company_id,
          property_id: propertyId,
          file_path: doc.url,
          file_type: doc.mimetype.substring(0, 100),
          type: doc.type as never,
          description: doc.description,
          created_by: doc.createdBy,
        } as never,
      });
      created.push({ id: record.id, url: doc.url, description: doc.description });
    }

    if (featuredIdentifier) {
      const matched = created.find((d) => d.url.includes(featuredIdentifier) || d.description === featuredIdentifier);
      if (matched) {
        await prisma.document.updateMany({ where: { property_id: propertyId, type: 'IMAGE' }, data: { is_featured: false } });
        await prisma.document.update({ where: { id: matched.id }, data: { is_featured: true } });
      }
    }
  }
}
