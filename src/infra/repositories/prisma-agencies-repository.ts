import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { AgenciesRepository } from '@/core/repositories/agencies-repository';
import type {
  Agency,
  ContactSuggestion,
  CreateAgencyData,
  ListAgenciesParams,
  PaginatedAgencies,
  UpdateAgencyData,
} from '@/core/entities/agency';
import { buildContactCreateData } from './shared/contact-channels';
import { buildDateTimeCondition } from '@/shared/utils/date-utils';

/**
 * Implementação Prisma de {@link AgenciesRepository}.
 *
 * Tenant-scoped: `Agency` está em TENANT_MODELS, então list/count/create
 * recebem o filtro/injeção de `company_id` da extensão do Prisma (rodando
 * dentro de `withTenant`). `Address`/`Contact`/`AgencyAddress` NÃO são
 * tenant-scoped (ligados via FK) — igual ao backend.
 *
 * Camada: infra.
 * Origem: api-nairim-v2/src/services/AgencyService.ts.
 */

const DIRECT_FIELDS = ['trade_name', 'legal_name', 'cnpj', 'state_registration', 'municipal_registration', 'license_number'];
const ADDRESS_FIELDS = ['city', 'state', 'district', 'street', 'zip_code'];
const CONTACT_RELATED = [...ADDRESS_FIELDS, 'contact_name', 'phone', 'cellphone', 'email'];
const SORTABLE_DIRECT = [...DIRECT_FIELDS, 'created_at', 'updated_at'];

const LIST_INCLUDE = {
  addresses: { where: { deleted_at: null }, include: { address: true } },
  contacts: { where: { deleted_at: null }, include: { channels: { where: { deleted_at: null }, orderBy: { display_order: 'asc' as const } } } },
  commission_category: true,
  commission_subcategory: true,
} as const;

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ñÑ]/g, 'n')
    .toLowerCase()
    .trim();
}

function normalizeDirection(direction: string): 'asc' | 'desc' {
  return String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
}

/** Condições de filtro: direto / endereço (relation) / contato (relation) / data. */
function buildFilterConditions(filters: Record<string, unknown>): Record<string, any> {
  const conditions: Record<string, any> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (DIRECT_FIELDS.includes(key)) {
      conditions[key] = { contains: String(value), mode: 'insensitive' };
    } else if (ADDRESS_FIELDS.includes(key)) {
      if (!conditions.addresses) conditions.addresses = { some: { address: {} } };
      conditions.addresses.some.address[key] = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'contact_name') {
      if (!conditions.contacts) conditions.contacts = { some: {} };
      conditions.contacts.some.contact = { contains: String(value), mode: 'insensitive' };
    } else if (['phone', 'cellphone', 'email'].includes(key)) {
      if (!conditions.contacts) conditions.contacts = { some: {} };
      conditions.contacts.some[key] = { contains: String(value), mode: 'insensitive' };
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

function buildOrderBy(sortOptions: Record<string, string>): Record<string, string>[] {
  const orderBy: Record<string, string>[] = [];
  Object.entries(sortOptions).forEach(([field, direction]) => {
    if (direction && SORTABLE_DIRECT.includes(field)) orderBy.push({ [field]: normalizeDirection(direction) });
  });
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
  return orderBy;
}

/** Busca em memória sobre campos diretos + endereço + contatos (acentos ignorados). */
function filterBySearch(agencies: any[], searchTerm: string): any[] {
  if (!searchTerm.trim()) return agencies;
  const normalized = normalizeText(searchTerm);
  return agencies.filter((agency) => {
    const direct = [agency.trade_name, agency.legal_name, agency.cnpj, agency.state_registration, agency.municipal_registration, agency.license_number].filter(Boolean).join(' ');
    const addressFields = (agency.addresses ?? [])
      .map((ta: any) => ta.address)
      .filter(Boolean)
      .map((addr: any) => [addr.street, addr.district, addr.city, addr.state, addr.zip_code].filter(Boolean).join(' '))
      .join(' ');
    const contactFields = (agency.contacts ?? [])
      .filter(Boolean)
      .map((c: any) => [c.contact, c.phone, c.cellphone, c.email].filter(Boolean).join(' '))
      .join(' ');
    return normalizeText([direct, addressFields, contactFields].join(' ')).includes(normalized);
  });
}

function sortByDirect(items: any[], field: string, direction: 'asc' | 'desc'): any[] {
  return [...items].sort((a, b) => {
    const strA = normalizeText(String(a[field] ?? ''));
    const strB = normalizeText(String(b[field] ?? ''));
    return direction === 'asc'
      ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' })
      : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
  });
}

function sortByRelated(agencies: any[], field: string, direction: 'asc' | 'desc'): any[] {
  return [...agencies].sort((a, b) => {
    let valueA = '';
    let valueB = '';
    if (ADDRESS_FIELDS.includes(field)) {
      valueA = a.addresses?.[0]?.address?.[field] || '';
      valueB = b.addresses?.[0]?.address?.[field] || '';
    } else if (field === 'contact_name') {
      valueA = a.contacts?.[0]?.contact || '';
      valueB = b.contacts?.[0]?.contact || '';
    } else if (['phone', 'cellphone', 'email'].includes(field)) {
      valueA = a.contacts?.[0]?.[field] || '';
      valueB = b.contacts?.[0]?.[field] || '';
    }
    const strA = normalizeText(String(valueA));
    const strB = normalizeText(String(valueB));
    return direction === 'asc'
      ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' })
      : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
  });
}

export class PrismaAgenciesRepository implements AgenciesRepository {
  async list(params: ListAgenciesParams): Promise<PaginatedAgencies> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters, params.includeInactive);

    const sortEntries = Object.entries(params.sortOptions);
    const sortField = sortEntries.length > 0 ? sortEntries[0][0] : '';
    const sortDirection = sortEntries.length > 0 ? normalizeDirection(sortEntries[0][1]) : 'asc';

    let agencies: any[] = [];
    let total = 0;

    // Busca global OU ordenação por campo de relação → processa em memória.
    if (params.search?.trim() || (sortField && CONTACT_RELATED.includes(sortField))) {
      const all = await prisma.agency.findMany({ where: where as never, include: LIST_INCLUDE });
      const filtered = params.search?.trim() ? filterBySearch(all, params.search) : all;
      total = filtered.length;

      if (sortField) {
        if (CONTACT_RELATED.includes(sortField)) agencies = sortByRelated(filtered, sortField, sortDirection);
        else if (SORTABLE_DIRECT.includes(sortField)) agencies = sortByDirect(filtered, sortField, sortDirection);
        else agencies = filtered;
      } else {
        agencies = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      agencies = agencies.slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.agency.findMany({ where: where as never, skip, take, orderBy: buildOrderBy(params.sortOptions) as never, include: LIST_INCLUDE }),
        prisma.agency.count({ where: where as never }),
      ]);
      agencies = data;
      total = count;
    }

    // ⚠️ Achado em teste E2E (2026-08-13): `Agency.commission_percentage` é
    // `@db.Decimal(5,2)` — o `include` (sem `select`) traz o campo cru do
    // Prisma como instância de `Decimal`, que quebra o boundary RSC ao ser
    // passada para Client Components. Mesma causa raiz corrigida em
    // `prisma-properties-repository.ts`/`prisma-leases-repository.ts`.
    agencies.forEach((a) => {
      if (a.commission_percentage != null) a.commission_percentage = Number(a.commission_percentage);
    });

    return { data: agencies as Agency[], count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    const where = buildWhere(filters ?? {}, false) as Record<string, any>;

    const [agencies, addresses, contacts, dateRange] = await Promise.all([
      prisma.agency.findMany({
        where: where as never,
        select: { trade_name: true, legal_name: true, cnpj: true, state_registration: true, municipal_registration: true, license_number: true },
        distinct: ['trade_name', 'legal_name', 'cnpj', 'state_registration', 'municipal_registration', 'license_number'],
      }),
      prisma.address.findMany({
        where: { deleted_at: null, agencyAddresses: { some: { agency: { deleted_at: null } } } },
        select: { city: true, state: true, district: true, street: true, zip_code: true },
        distinct: ['city', 'state', 'district', 'street', 'zip_code'],
      }),
      prisma.contact.findMany({
        where: { deleted_at: null, agency_id: { not: null }, agency: { deleted_at: null } },
        select: { contact: true, phone: true, cellphone: true, email: true },
        distinct: ['contact', 'phone', 'cellphone', 'email'],
      }),
      prisma.agency.aggregate({ where: where as never, _min: { created_at: true }, _max: { created_at: true } }),
    ]);

    const uniq = (arr: (string | null)[]) => [...new Set(arr.filter(Boolean) as string[])].sort();

    return {
      filters: [
        { field: 'trade_name', type: 'string', label: 'Nome Fantasia', values: uniq(agencies.map((a) => a.trade_name)), searchable: true },
        { field: 'legal_name', type: 'string', label: 'Razão Social', values: uniq(agencies.map((a) => a.legal_name)), searchable: true },
        { field: 'cnpj', type: 'string', label: 'CNPJ', values: uniq(agencies.map((a) => a.cnpj)), searchable: true },
        { field: 'state_registration', type: 'string', label: 'Inscrição Estadual', values: uniq(agencies.map((a) => a.state_registration)), searchable: true },
        { field: 'municipal_registration', type: 'string', label: 'Inscrição Municipal', values: uniq(agencies.map((a) => a.municipal_registration)), searchable: true },
        { field: 'license_number', type: 'string', label: 'Número da Licença', values: uniq(agencies.map((a) => a.license_number)), searchable: true },
        { field: 'created_at', type: 'date', label: 'Criado em', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true },
        { field: 'city', type: 'string', label: 'Cidade', values: uniq(addresses.map((a) => a.city)), searchable: true },
        { field: 'state', type: 'string', label: 'Estado', values: uniq(addresses.map((a) => a.state)), searchable: true },
        { field: 'district', type: 'string', label: 'Bairro', values: uniq(addresses.map((a) => a.district)), searchable: true },
        { field: 'street', type: 'string', label: 'Rua', values: uniq(addresses.map((a) => a.street)), searchable: true },
        { field: 'zip_code', type: 'string', label: 'CEP', values: uniq(addresses.map((a) => a.zip_code)), searchable: true },
        { field: 'contact_name', type: 'string', label: 'Nome do Contato', values: uniq(contacts.map((c) => c.contact)), searchable: true },
        { field: 'phone', type: 'string', label: 'Telefone', values: uniq(contacts.map((c) => c.phone)), searchable: true },
        { field: 'cellphone', type: 'string', label: 'Celular', values: uniq(contacts.map((c) => c.cellphone)), searchable: true },
        { field: 'email', type: 'string', label: 'E-mail', values: uniq(contacts.map((c) => c.email)), searchable: true },
      ],
      operators: {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        select: ['equals', 'in'],
      },
      defaultSort: 'created_at:desc',
      searchFields: ['trade_name', 'legal_name', 'cnpj', 'state_registration', 'municipal_registration', 'license_number', ...CONTACT_RELATED],
    };
  }

  async findById(id: string): Promise<Agency | null> {
    const agency = await prisma.agency.findFirst({
      where: { id, deleted_at: null },
      include: { addresses: { where: { deleted_at: null }, include: { address: true } }, contacts: { where: { deleted_at: null }, include: { channels: { where: { deleted_at: null }, orderBy: { display_order: 'asc' as const } } } } },
    });
    if (agency && (agency as any).commission_percentage != null) {
      (agency as any).commission_percentage = Number((agency as any).commission_percentage);
    }
    return (agency as Agency) ?? null;
  }

  async cnpjExists(cnpj: string): Promise<boolean> {
    const found = await prisma.agency.findFirst({ where: { cnpj, deleted_at: null }, select: { id: true } });
    return !!found;
  }

  async cnpjExistsExcept(cnpj: string, exceptId: string): Promise<boolean> {
    const found = await prisma.agency.findFirst({ where: { cnpj, deleted_at: null, NOT: { id: exceptId } }, select: { id: true } });
    return !!found;
  }

  async create(data: CreateAgencyData): Promise<Agency> {
    // `tx` (dentro de $transaction) não passa pela extensão multi-tenant —
    // company_id precisa ser injetado explicitamente (o comentário anterior
    // aqui estava errado: a extensão só cobre a instância `prisma` exportada).
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Contexto de empresa não identificado.');

    const agency = await prisma.$transaction(async (tx: any) => {
      const newAgency = await tx.agency.create({
        data: {
          company_id: companyId,
          trade_name: data.trade_name,
          legal_name: data.legal_name,
          cnpj: data.cnpj,
          state_registration: data.state_registration,
          municipal_registration: data.municipal_registration,
          license_number: data.license_number,
          commission_category_id: data.commission_category_id || null,
          commission_subcategory_id: data.commission_subcategory_id || null,
        },
      });

      for (const contact of data.contacts ?? []) {
        await tx.contact.create({ data: buildContactCreateData(contact, { agency_id: newAgency.id }) });
      }

      for (const address of data.addresses ?? []) {
        const newAddress = await tx.address.create({
          data: {
            zip_code: address.zip_code,
            street: address.street,
            number: address.number,
            district: address.district,
            city: address.city,
            state: address.state,
            country: address.country || 'Brasil',
          },
        });
        await tx.agencyAddress.create({ data: { agency_id: newAgency.id, address_id: newAddress.id } });
      }

      return newAgency;
    });
    return agency as Agency;
  }

  async update(id: string, data: UpdateAgencyData): Promise<Agency> {
    const agency = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.agency.update({
        where: { id },
        data: {
          trade_name: data.trade_name,
          legal_name: data.legal_name,
          cnpj: data.cnpj,
          state_registration: data.state_registration,
          municipal_registration: data.municipal_registration,
          license_number: data.license_number,
          commission_category_id: data.commission_category_id || null,
          commission_subcategory_id: data.commission_subcategory_id || null,
        },
      });

      // Se contacts vieram: soft-delete os atuais e recria (igual ao backend).
      if (data.contacts !== undefined) {
        await tx.contact.updateMany({ where: { agency_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
        for (const contact of data.contacts ?? []) {
          await tx.contact.create({ data: buildContactCreateData(contact, { agency_id: id }) });
        }
      }

      if (data.addresses !== undefined) {
        await tx.agencyAddress.updateMany({ where: { agency_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
        for (const address of data.addresses ?? []) {
          const newAddress = await tx.address.create({
            data: {
              zip_code: address.zip_code,
              street: address.street,
              number: address.number,
              district: address.district,
              city: address.city,
              state: address.state,
              country: address.country || 'Brasil',
            },
          });
          await tx.agencyAddress.create({ data: { agency_id: id, address_id: newAddress.id } });
        }
      }

      return updated;
    });
    return agency as Agency;
  }

  async softDelete(id: string): Promise<{ legal_name: string }> {
    const agency = await prisma.agency.findFirst({ where: { id, deleted_at: null }, select: { legal_name: true } });
    if (!agency) throw new Error('Imobiliária não encontrada ou já excluída');
    await prisma.agency.update({
      where: { id },
      data: { deleted_at: new Date(), contacts: { updateMany: { where: { agency_id: id }, data: { deleted_at: new Date() } } } },
    });
    return { legal_name: agency.legal_name };
  }

  async findDeletionState(id: string): Promise<{ legal_name: string; deleted_at: Date | null } | null> {
    const agency = await prisma.agency.findFirst({ where: { id }, select: { legal_name: true, deleted_at: true } });
    return agency ?? null;
  }

  async restore(id: string): Promise<{ legal_name: string }> {
    const agency = await prisma.agency.update({
      where: { id },
      data: { deleted_at: null, contacts: { updateMany: { where: { agency_id: id }, data: { deleted_at: null } } } },
      select: { legal_name: true },
    });
    return { legal_name: agency.legal_name };
  }

  async getAvailableContacts(search: string): Promise<ContactSuggestion[]> {
    const where: Record<string, unknown> = { deleted_at: null };
    if (search.trim()) {
      where.OR = [
        { contact: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { cellphone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where: where as never,
      select: { contact: true, phone: true, cellphone: true, email: true },
      take: 50,
      orderBy: { created_at: 'desc' },
    });

    // Deduplica por celular/telefone/email.
    const unique = new Map<string, ContactSuggestion>();
    for (const c of contacts) {
      const key = c.cellphone || c.phone || c.email;
      if (key && !unique.has(key)) {
        unique.set(key, { contact: c.contact, phone: c.phone, cellphone: c.cellphone, email: c.email });
      }
    }
    return Array.from(unique.values());
  }
}
