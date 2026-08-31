import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { TenantsRepository } from '@/core/repositories/tenants-repository';
import type { ContactSuggestion } from '@/core/entities/agency';
import type {
  CreateTenantData,
  ListTenantsParams,
  PaginatedTenants,
  Tenant,
  UpdateTenantData,
} from '@/core/entities/tenant';
import { buildContactCreateData } from './shared/contact-channels';

/**
 * Implementação Prisma de {@link TenantsRepository}.
 * Porte de api-nairim-v2/src/services/TenantService.ts.
 *
 * Tenant-scoped (empresa): `Tenant` está em TENANT_MODELS. `Address`/`Contact`/
 * `TenantAddress` não são tenant-scoped, igual ao backend.
 *
 * Camada: infra.
 */

const DIRECT_FIELDS = ['name', 'internal_code', 'occupation', 'marital_status', 'cpf', 'cnpj', 'state_registration', 'municipal_registration'];
const ADDRESS_FIELDS = ['city', 'state', 'district', 'street', 'zip_code', 'complement'];
const CONTACT_RELATED = [...ADDRESS_FIELDS, 'contact_name', 'phone', 'cellphone', 'email'];
const SORTABLE_DIRECT = [...DIRECT_FIELDS, 'created_at', 'updated_at'];

const LIST_INCLUDE = {
  addresses: { where: { deleted_at: null }, include: { address: true } },
  contacts: { where: { deleted_at: null }, include: { channels: { where: { deleted_at: null }, orderBy: { display_order: 'asc' as const } } } },
  leases: true,
} as const;

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
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
      conditions.created_at = buildDateCondition(value);
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
    if (direction && SORTABLE_DIRECT.includes(field)) orderBy.push({ [field]: direction });
  });
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
  return orderBy;
}

function filterBySearch(tenants: any[], searchTerm: string): any[] {
  if (!searchTerm.trim()) return tenants;
  const normalized = normalizeText(searchTerm);
  return tenants.filter((tenant) => {
    const direct = [tenant.name, tenant.internal_code, tenant.occupation, tenant.marital_status, tenant.cpf, tenant.cnpj, tenant.state_registration, tenant.municipal_registration].filter(Boolean).join(' ');
    const addressFields = (tenant.addresses ?? [])
      .map((ta: any) => ta.address).filter(Boolean)
      .map((a: any) => [a.street, a.district, a.city, a.state, a.zip_code, a.complement].filter(Boolean).join(' ')).join(' ');
    const contactFields = (tenant.contacts ?? [])
      .filter(Boolean)
      .map((c: any) => [c.contact, c.phone, c.cellphone, c.email].filter(Boolean).join(' ')).join(' ');
    return normalizeText([direct, addressFields, contactFields].join(' ')).includes(normalized);
  });
}

function sortByDirect(items: any[], field: string, direction: 'asc' | 'desc'): any[] {
  return [...items].sort((a, b) => {
    const strA = normalizeText(String(a[field] ?? ''));
    const strB = normalizeText(String(b[field] ?? ''));
    return direction === 'asc' ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' }) : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
  });
}

function sortByRelated(items: any[], field: string, direction: 'asc' | 'desc'): any[] {
  return [...items].sort((a, b) => {
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
    return direction === 'asc' ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' }) : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
  });
}

export class PrismaTenantsRepository implements TenantsRepository {
  async list(params: ListTenantsParams): Promise<PaginatedTenants> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters, params.includeInactive);

    const sortEntries = Object.entries(params.sortOptions);
    const sortField = sortEntries[0]?.[0];
    const sortDirection = sortEntries[0]?.[1] as 'asc' | 'desc' | undefined;

    let tenants: any[] = [];
    let total = 0;

    if (params.search?.trim() || (sortField && sortDirection && CONTACT_RELATED.includes(sortField))) {
      const all = await prisma.tenant.findMany({ where: where as never, include: LIST_INCLUDE });
      const filtered = params.search?.trim() ? filterBySearch(all, params.search) : all;
      total = filtered.length;

      if (sortField && sortDirection) {
        tenants = CONTACT_RELATED.includes(sortField)
          ? sortByRelated(filtered, sortField, sortDirection)
          : SORTABLE_DIRECT.includes(sortField)
            ? sortByDirect(filtered, sortField, sortDirection)
            : filtered;
      } else {
        tenants = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      tenants = tenants.slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.tenant.findMany({ where: where as never, skip, take, orderBy: buildOrderBy(params.sortOptions) as never, include: LIST_INCLUDE }),
        prisma.tenant.count({ where: where as never }),
      ]);
      tenants = data;
      total = count;
    }

    return { data: tenants as Tenant[], count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    const where: Record<string, any> = { deleted_at: null };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value || value === '') return;
      Object.assign(where, buildFilterConditions({ [key]: value }));
    });

    const [tenants, addresses, contacts, dateRange] = await Promise.all([
      prisma.tenant.findMany({
        where: where as never,
        select: { name: true, internal_code: true, occupation: true, marital_status: true, cpf: true, cnpj: true, state_registration: true, municipal_registration: true },
        distinct: ['name', 'internal_code', 'occupation', 'marital_status', 'cpf', 'cnpj', 'state_registration', 'municipal_registration'],
      }),
      prisma.address.findMany({
        where: { deleted_at: null, tenantAddresses: { some: { tenant: { deleted_at: null } } } },
        select: { city: true, state: true, district: true, street: true, zip_code: true, complement: true },
        distinct: ['city', 'state', 'district', 'street', 'zip_code', 'complement'],
      }),
      prisma.contact.findMany({
        where: { deleted_at: null, tenant_id: { not: null }, tenant: { deleted_at: null } },
        select: { contact: true, phone: true, cellphone: true, email: true },
        distinct: ['contact', 'phone', 'cellphone', 'email'],
      }),
      prisma.tenant.aggregate({ where: where as never, _min: { created_at: true }, _max: { created_at: true } }),
    ]);

    const uniq = (arr: (string | null)[]) => [...new Set(arr.filter(Boolean) as string[])].sort();

    return {
      filters: [
        { field: 'name', type: 'string', label: 'Nome', values: uniq(tenants.map((t) => t.name)), searchable: true },
        { field: 'internal_code', type: 'string', label: 'Código Interno', values: uniq(tenants.map((t) => t.internal_code)), searchable: true },
        { field: 'cpf', type: 'string', label: 'CPF', values: uniq(tenants.map((t) => t.cpf)), searchable: true },
        { field: 'cnpj', type: 'string', label: 'CNPJ', values: uniq(tenants.map((t) => t.cnpj)), searchable: true },
        { field: 'occupation', type: 'string', label: 'Profissão', values: uniq(tenants.map((t) => t.occupation)), searchable: true },
        { field: 'marital_status', type: 'string', label: 'Estado Civil', values: uniq(tenants.map((t) => t.marital_status)), searchable: true },
        { field: 'state_registration', type: 'string', label: 'Inscrição Estadual', values: uniq(tenants.map((t) => t.state_registration)), searchable: true },
        { field: 'municipal_registration', type: 'string', label: 'Inscrição Municipal', values: uniq(tenants.map((t) => t.municipal_registration)), searchable: true },
        { field: 'city', type: 'string', label: 'Cidade', values: uniq(addresses.map((a) => a.city)), searchable: true },
        { field: 'state', type: 'string', label: 'Estado', values: uniq(addresses.map((a) => a.state)), searchable: true },
        { field: 'contact_name', type: 'string', label: 'Nome do Contato', values: uniq(contacts.map((c) => c.contact)), searchable: true },
        { field: 'phone', type: 'string', label: 'Telefone', values: uniq(contacts.map((c) => c.phone)), searchable: true },
        { field: 'cellphone', type: 'string', label: 'Celular', values: uniq(contacts.map((c) => c.cellphone)), searchable: true },
        { field: 'email', type: 'string', label: 'E-mail', values: uniq(contacts.map((c) => c.email)), searchable: true },
        { field: 'created_at', type: 'date', label: 'Criado em', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true },
      ],
      operators: {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        select: ['equals', 'in'],
      },
      defaultSort: 'created_at:desc',
      // Fiel ao backend: searchFields do TenantService NÃO inclui district/street/zip_code/
      // complement/state_registration/municipal_registration (gap herdado do legado).
      searchFields: ['name', 'internal_code', 'cpf', 'cnpj', 'occupation', 'marital_status', 'city', 'state', 'contact_name', 'phone', 'cellphone', 'email'],
    };
  }

  async findById(id: string): Promise<Tenant | null> {
    const tenant = await prisma.tenant.findFirst({
      where: { id, deleted_at: null },
      include: { addresses: { where: { deleted_at: null }, include: { address: true } }, contacts: { where: { deleted_at: null }, include: { channels: { where: { deleted_at: null }, orderBy: { display_order: 'asc' as const } } } }, leases: true },
    });
    return (tenant as Tenant) ?? null;
  }

  async internalCodeExists(code: string): Promise<boolean> {
    return !!(await prisma.tenant.findFirst({ where: { internal_code: code, deleted_at: null }, select: { id: true } }));
  }
  async internalCodeExistsExcept(code: string, exceptId: string): Promise<boolean> {
    return !!(await prisma.tenant.findFirst({ where: { internal_code: code, deleted_at: null, NOT: { id: exceptId } }, select: { id: true } }));
  }
  async cpfExists(cpf: string): Promise<boolean> {
    return !!(await prisma.tenant.findFirst({ where: { cpf, deleted_at: null }, select: { id: true } }));
  }
  async cpfExistsExcept(cpf: string, exceptId: string): Promise<boolean> {
    return !!(await prisma.tenant.findFirst({ where: { cpf, deleted_at: null, NOT: { id: exceptId } }, select: { id: true } }));
  }
  async cnpjExists(cnpj: string): Promise<boolean> {
    return !!(await prisma.tenant.findFirst({ where: { cnpj, deleted_at: null }, select: { id: true } }));
  }
  async cnpjExistsExcept(cnpj: string, exceptId: string): Promise<boolean> {
    return !!(await prisma.tenant.findFirst({ where: { cnpj, deleted_at: null, NOT: { id: exceptId } }, select: { id: true } }));
  }

  /**
   * MAX numérico dos internal_code da empresa + 1. Fiel ao backend
   * (TenantService.getNextInternalCode): busca todos os códigos (o extension
   * multi-tenant já injeta company_id no findMany), ignora os não numéricos
   * (`/^\d+$/`) e soma 1 ao maior; sem registros numéricos → "1".
   * Substitui o antigo sort[internal_code]=desc do front, que ordenava a
   * string lexicograficamente ("9" > "12") e sugeria códigos já usados.
   */
  async getNextInternalCode(): Promise<string> {
    const tenants = await prisma.tenant.findMany({ select: { internal_code: true } });
    const max = tenants.reduce((acc: number, t: { internal_code: string | null }) => {
      const code = String(t.internal_code ?? '').trim();
      if (!/^\d+$/.test(code)) return acc;
      const n = parseInt(code, 10);
      return n > acc ? n : acc;
    }, 0);
    return String(max + 1);
  }

  async create(data: CreateTenantData): Promise<Tenant> {
    // Fiel ao backend: todos os campos são gravados como recebidos, sem
    // exclusão mútua PF/PJ (ver nota em core/use-cases/tenant/crud.ts).
    // `tx` (dentro de $transaction) não passa pela extensão multi-tenant —
    // company_id precisa ser injetado explicitamente.
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Contexto de empresa não identificado.');

    const created = await prisma.$transaction(async (tx: any) => {
      const newTenant = await tx.tenant.create({
        data: {
          company_id: companyId,
          name: data.name,
          internal_code: data.internal_code,
          nationality: data.nationality ?? null,
          occupation: data.occupation ?? null,
          marital_status: data.marital_status ?? null,
          cpf: data.cpf ?? null,
          rg: data.rg ?? null,
          rg_issuing_body: data.rg_issuing_body ?? null,
          rg_issuing_state: data.rg_issuing_state ?? null,
          cnpj: data.cnpj ?? null,
          state_registration: data.state_registration ?? null,
          municipal_registration: data.municipal_registration ?? null,
        },
      });

      for (const contact of data.contacts ?? []) {
        await tx.contact.create({ data: buildContactCreateData(contact, { tenant_id: newTenant.id }) });
      }
      for (const address of data.addresses ?? []) {
        const newAddress = await tx.address.create({
          data: { zip_code: address.zip_code, street: address.street, number: address.number, complement: address.complement || null, district: address.district, city: address.city, state: address.state, country: address.country || 'Brasil' },
        });
        await tx.tenantAddress.create({ data: { tenant_id: newTenant.id, address_id: newAddress.id } });
      }
      return newTenant;
    });
    return (await this.findById(created.id))!;
  }

  async update(id: string, data: UpdateTenantData): Promise<Tenant> {
    await prisma.$transaction(async (tx: any) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.internal_code !== undefined) updateData.internal_code = data.internal_code;
      if (data.nationality !== undefined) updateData.nationality = data.nationality;
      if (data.occupation !== undefined) updateData.occupation = data.occupation;
      if (data.marital_status !== undefined) updateData.marital_status = data.marital_status;
      if (data.cpf !== undefined) updateData.cpf = data.cpf;
      if (data.rg !== undefined) updateData.rg = data.rg;
      if (data.rg_issuing_body !== undefined) updateData.rg_issuing_body = data.rg_issuing_body;
      if (data.rg_issuing_state !== undefined) updateData.rg_issuing_state = data.rg_issuing_state;
      if (data.cnpj !== undefined) updateData.cnpj = data.cnpj;
      if (data.state_registration !== undefined) updateData.state_registration = data.state_registration;
      if (data.municipal_registration !== undefined) updateData.municipal_registration = data.municipal_registration;

      await tx.tenant.update({ where: { id }, data: updateData });

      if (data.contacts !== undefined) {
        await tx.contact.updateMany({ where: { tenant_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
        for (const contact of data.contacts ?? []) {
          await tx.contact.create({ data: buildContactCreateData(contact, { tenant_id: id }) });
        }
      }
      if (data.addresses !== undefined) {
        await tx.tenantAddress.updateMany({ where: { tenant_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
        for (const address of data.addresses ?? []) {
          const newAddress = await tx.address.create({
            data: { zip_code: address.zip_code, street: address.street, number: address.number, complement: address.complement || null, district: address.district, city: address.city, state: address.state, country: address.country || 'Brasil' },
          });
          await tx.tenantAddress.create({ data: { tenant_id: id, address_id: newAddress.id } });
        }
      }
    });
    return (await this.findById(id))!;
  }

  /**
   * Fiel ao backend: não verifica existência antes — se `id` não existir, o
   * `tx.tenant.update` lança P2025, traduzido para 404 pelo error-handler.
   */
  async softDelete(id: string): Promise<{ name: string }> {
    const tenant = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.tenant.update({ where: { id }, data: { deleted_at: new Date() }, select: { name: true } });
      await tx.contact.updateMany({ where: { tenant_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
      await tx.tenantAddress.updateMany({ where: { tenant_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
      return updated;
    });
    return { name: tenant.name };
  }

  async findDeletionState(id: string): Promise<{ name: string; deleted_at: Date | null } | null> {
    const tenant = await prisma.tenant.findFirst({ where: { id }, select: { name: true, deleted_at: true } });
    return tenant ?? null;
  }

  async restore(id: string): Promise<Tenant> {
    await prisma.$transaction(async (tx: any) => {
      await tx.tenant.update({ where: { id }, data: { deleted_at: null } });
      await tx.contact.updateMany({ where: { tenant_id: id }, data: { deleted_at: null } });
      await tx.tenantAddress.updateMany({ where: { tenant_id: id }, data: { deleted_at: null } });
    });
    return (await this.findById(id))!;
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
    const contacts = await prisma.contact.findMany({ where: where as never, select: { contact: true, phone: true, cellphone: true, email: true }, take: 50, orderBy: { created_at: 'desc' } });
    const unique = new Map<string, ContactSuggestion>();
    for (const c of contacts) {
      const key = c.cellphone || c.phone || c.email;
      if (key && !unique.has(key)) unique.set(key, { contact: c.contact, phone: c.phone, cellphone: c.cellphone, email: c.email });
    }
    return Array.from(unique.values());
  }
}
