import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { OwnersRepository } from '@/core/repositories/owners-repository';
import type { ContactSuggestion } from '@/core/entities/agency';
import type {
  CreateOwnerData,
  ListOwnersParams,
  Owner,
  PaginatedOwners,
  UpdateOwnerData,
} from '@/core/entities/owner';

/**
 * Implementação Prisma de {@link OwnersRepository}.
 * Porte de api-nairim-v2/src/services/OwnerService.ts.
 *
 * Tenant-scoped: `Owner` está em TENANT_MODELS. `Address`/`Contact`/
 * `OwnerAddress` não são tenant-scoped (ligados via FK), igual ao backend.
 *
 * Camada: infra.
 */

const DIRECT_FIELDS = ['name', 'internal_code', 'occupation', 'marital_status', 'cpf', 'cnpj', 'state_registration', 'municipal_registration'];
const ADDRESS_FIELDS = ['city', 'state', 'district', 'street', 'zip_code', 'complement'];
const CONTACT_RELATED = [...ADDRESS_FIELDS, 'contact_name', 'phone', 'cellphone', 'email'];
const SORTABLE_DIRECT = [...DIRECT_FIELDS, 'created_at', 'updated_at'];

const LIST_INCLUDE = {
  addresses: { where: { deleted_at: null }, include: { address: true } },
  contacts: { where: { deleted_at: null } },
  properties: { where: { deleted_at: null }, select: { id: true, title: true } },
  leases: { where: { deleted_at: null }, select: { id: true, contract_number: true } },
} as const;

const DETAIL_INCLUDE = {
  addresses: { where: { deleted_at: null }, include: { address: true } },
  contacts: { where: { deleted_at: null } },
  properties: {
    where: { deleted_at: null },
    include: { type: true, addresses: { where: { deleted_at: null }, include: { address: true } } },
  },
  leases: {
    where: { deleted_at: null },
    include: {
      property: { include: { type: true, addresses: { where: { deleted_at: null }, include: { address: true } } } },
      tenant: true,
    },
  },
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

function filterBySearch(owners: any[], searchTerm: string): any[] {
  if (!searchTerm.trim()) return owners;
  const normalized = normalizeText(searchTerm);
  return owners.filter((owner) => {
    const direct = [owner.name, owner.internal_code, owner.occupation, owner.marital_status, owner.cpf, owner.cnpj, owner.state_registration, owner.municipal_registration].filter(Boolean).join(' ');
    const addressFields = (owner.addresses ?? [])
      .map((ta: any) => ta.address).filter(Boolean)
      .map((a: any) => [a.street, a.district, a.city, a.state, a.zip_code, a.complement].filter(Boolean).join(' ')).join(' ');
    const contactFields = (owner.contacts ?? [])
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

export class PrismaOwnersRepository implements OwnersRepository {
  async list(params: ListOwnersParams): Promise<PaginatedOwners> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters, params.includeInactive);

    const sortEntries = Object.entries(params.sortOptions);
    const sortField = sortEntries[0]?.[0];
    const sortDirection = sortEntries[0]?.[1] as 'asc' | 'desc' | undefined;

    let owners: any[] = [];
    let total = 0;

    if (params.search?.trim() || (sortField && sortDirection && CONTACT_RELATED.includes(sortField))) {
      const all = await prisma.owner.findMany({ where: where as never, include: LIST_INCLUDE });
      const filtered = params.search?.trim() ? filterBySearch(all, params.search) : all;
      total = filtered.length;

      if (sortField && sortDirection) {
        owners = CONTACT_RELATED.includes(sortField)
          ? sortByRelated(filtered, sortField, sortDirection)
          : SORTABLE_DIRECT.includes(sortField)
            ? sortByDirect(filtered, sortField, sortDirection)
            : filtered;
      } else {
        owners = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      owners = owners.slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.owner.findMany({ where: where as never, skip, take, orderBy: buildOrderBy(params.sortOptions) as never, include: LIST_INCLUDE }),
        prisma.owner.count({ where: where as never }),
      ]);
      owners = data;
      total = count;
    }

    return { data: owners as Owner[], count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    const where: Record<string, any> = { deleted_at: null };
    const andFilters: any[] = [];
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value || value === '') return;
      if (DIRECT_FIELDS.includes(key)) andFilters.push({ [key]: { contains: String(value), mode: 'insensitive' } });
      else if (ADDRESS_FIELDS.includes(key)) andFilters.push({ addresses: { some: { address: { [key]: { contains: String(value), mode: 'insensitive' } } } } });
      else if (key === 'contact_name') andFilters.push({ contacts: { some: { contact: { contains: String(value), mode: 'insensitive' } } } });
      else if (['phone', 'cellphone', 'email'].includes(key)) andFilters.push({ contacts: { some: { [key]: { contains: String(value), mode: 'insensitive' } } } });
    });
    if (andFilters.length > 0) where.AND = andFilters;

    const [owners, addresses, contacts, dateRange] = await Promise.all([
      prisma.owner.findMany({
        where: where as never,
        select: { name: true, internal_code: true, occupation: true, marital_status: true, cpf: true, cnpj: true, state_registration: true, municipal_registration: true },
        distinct: ['name', 'internal_code', 'occupation', 'marital_status', 'cpf', 'cnpj', 'state_registration', 'municipal_registration'],
      }),
      prisma.address.findMany({
        where: { deleted_at: null, ownerAddresses: { some: { owner: { deleted_at: null } } } },
        select: { city: true, state: true, district: true, street: true, zip_code: true, complement: true },
        distinct: ['city', 'state', 'district', 'street', 'zip_code', 'complement'],
      }),
      prisma.contact.findMany({
        where: { deleted_at: null, owner_id: { not: null }, owner: { deleted_at: null } },
        select: { contact: true, phone: true, cellphone: true, email: true },
        distinct: ['contact', 'phone', 'cellphone', 'email'],
      }),
      prisma.owner.aggregate({ where: where as never, _min: { created_at: true }, _max: { created_at: true } }),
    ]);

    const uniq = (arr: (string | null)[]) => [...new Set(arr.filter(Boolean) as string[])].sort();

    return {
      filters: [
        { field: 'name', type: 'string', label: 'Nome', values: uniq(owners.map((o) => o.name)), searchable: true },
        { field: 'internal_code', type: 'string', label: 'Código Interno', values: uniq(owners.map((o) => o.internal_code)), searchable: true },
        { field: 'occupation', type: 'string', label: 'Profissão', values: uniq(owners.map((o) => o.occupation)), searchable: true },
        { field: 'marital_status', type: 'string', label: 'Estado Civil', values: uniq(owners.map((o) => o.marital_status)), searchable: true },
        { field: 'cpf', type: 'string', label: 'CPF', values: uniq(owners.map((o) => o.cpf)), searchable: true },
        { field: 'cnpj', type: 'string', label: 'CNPJ', values: uniq(owners.map((o) => o.cnpj)), searchable: true },
        { field: 'state_registration', type: 'string', label: 'Inscrição Estadual', values: uniq(owners.map((o) => o.state_registration)), searchable: true },
        { field: 'municipal_registration', type: 'string', label: 'Inscrição Municipal', values: uniq(owners.map((o) => o.municipal_registration)), searchable: true },
        { field: 'created_at', type: 'date', label: 'Criado em', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true },
        { field: 'city', type: 'string', label: 'Cidade', values: uniq(addresses.map((a) => a.city)), searchable: true },
        { field: 'state', type: 'string', label: 'Estado', values: uniq(addresses.map((a) => a.state)), searchable: true },
        { field: 'district', type: 'string', label: 'Bairro', values: uniq(addresses.map((a) => a.district)), searchable: true },
        { field: 'street', type: 'string', label: 'Rua', values: uniq(addresses.map((a) => a.street)), searchable: true },
        { field: 'zip_code', type: 'string', label: 'CEP', values: uniq(addresses.map((a) => a.zip_code)), searchable: true },
        { field: 'complement', type: 'string', label: 'Complemento', values: uniq(addresses.map((a) => a.complement)), searchable: true },
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
      searchFields: ['name', 'internal_code', 'cpf', 'cnpj', 'state_registration', 'municipal_registration', 'occupation', 'marital_status', ...CONTACT_RELATED],
    };
  }

  async findById(id: string): Promise<Owner | null> {
    const owner = await prisma.owner.findFirst({ where: { id, deleted_at: null }, include: DETAIL_INCLUDE });
    return (owner as Owner) ?? null;
  }

  async internalCodeExists(code: string): Promise<boolean> {
    return !!(await prisma.owner.findFirst({ where: { internal_code: code, deleted_at: null }, select: { id: true } }));
  }
  async internalCodeExistsExcept(code: string, exceptId: string): Promise<boolean> {
    return !!(await prisma.owner.findFirst({ where: { internal_code: code, deleted_at: null, NOT: { id: exceptId } }, select: { id: true } }));
  }
  async cpfExists(cpf: string): Promise<boolean> {
    return !!(await prisma.owner.findFirst({ where: { cpf, deleted_at: null }, select: { id: true } }));
  }
  async cpfExistsExcept(cpf: string, exceptId: string): Promise<boolean> {
    return !!(await prisma.owner.findFirst({ where: { cpf, deleted_at: null, NOT: { id: exceptId } }, select: { id: true } }));
  }
  async cnpjExists(cnpj: string): Promise<boolean> {
    return !!(await prisma.owner.findFirst({ where: { cnpj, deleted_at: null }, select: { id: true } }));
  }
  async cnpjExistsExcept(cnpj: string, exceptId: string): Promise<boolean> {
    return !!(await prisma.owner.findFirst({ where: { cnpj, deleted_at: null, NOT: { id: exceptId } }, select: { id: true } }));
  }

  async create(data: CreateOwnerData): Promise<Owner> {
    // `tx` (dentro de $transaction) não passa pela extensão multi-tenant do
    // Prisma — só a instância `prisma` exportada é estendida. Sem isso,
    // `company_id` nunca era injetado e o create falhava com "Argument
    // `company` is missing.".
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Contexto de empresa não identificado.');

    const created = await prisma.$transaction(async (tx: any) => {
      const newOwner = await tx.owner.create({
        data: {
          company_id: companyId,
          name: data.name,
          internal_code: data.internal_code,
          occupation: data.occupation ?? null,
          marital_status: data.marital_status ?? null,
          cpf: data.cpf ?? null,
          cnpj: data.cnpj ?? null,
          state_registration: data.state_registration ?? null,
          municipal_registration: data.municipal_registration ?? null,
        },
      });

      for (const contact of data.contacts ?? []) {
        await tx.contact.create({ data: { contact: contact.contact || null, phone: contact.phone || null, cellphone: contact.cellphone || null, email: contact.email || null, owner_id: newOwner.id } });
      }
      for (const address of data.addresses ?? []) {
        const newAddress = await tx.address.create({
          data: { zip_code: address.zip_code, street: address.street, number: address.number, complement: address.complement || null, district: address.district, city: address.city, state: address.state, country: address.country || 'Brasil' },
        });
        await tx.ownerAddress.create({ data: { owner_id: newOwner.id, address_id: newAddress.id } });
      }
      return newOwner;
    });
    return (await this.findById(created.id))!;
  }

  async update(id: string, data: UpdateOwnerData): Promise<Owner> {
    await prisma.$transaction(async (tx: any) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.internal_code !== undefined) updateData.internal_code = data.internal_code;
      if (data.occupation !== undefined) updateData.occupation = data.occupation;
      if (data.marital_status !== undefined) updateData.marital_status = data.marital_status;
      if (data.cpf !== undefined) updateData.cpf = data.cpf;
      if (data.cnpj !== undefined) updateData.cnpj = data.cnpj;
      if (data.state_registration !== undefined) updateData.state_registration = data.state_registration;
      if (data.municipal_registration !== undefined) updateData.municipal_registration = data.municipal_registration;

      await tx.owner.update({ where: { id }, data: updateData });

      if (data.contacts !== undefined) {
        await tx.contact.updateMany({ where: { owner_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
        for (const contact of data.contacts ?? []) {
          await tx.contact.create({ data: { contact: contact.contact || null, phone: contact.phone || null, cellphone: contact.cellphone || null, email: contact.email || null, owner_id: id } });
        }
      }
      if (data.addresses !== undefined) {
        await tx.ownerAddress.updateMany({ where: { owner_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
        for (const address of data.addresses ?? []) {
          const newAddress = await tx.address.create({
            data: { zip_code: address.zip_code, street: address.street, number: address.number, complement: address.complement || null, district: address.district, city: address.city, state: address.state, country: address.country || 'Brasil' },
          });
          await tx.ownerAddress.create({ data: { owner_id: id, address_id: newAddress.id } });
        }
      }
    });
    return (await this.findById(id))!;
  }

  async softDelete(id: string): Promise<{ name: string } | null> {
    const owner = await prisma.owner.findFirst({ where: { id, deleted_at: null }, select: { name: true } });
    if (!owner) return null;

    await prisma.$transaction(async (tx: any) => {
      await tx.owner.update({ where: { id }, data: { deleted_at: new Date() } });
      await tx.contact.updateMany({ where: { owner_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
      await tx.ownerAddress.updateMany({ where: { owner_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
    });
    return { name: owner.name };
  }

  async findDeletionState(id: string): Promise<{ name: string; deleted_at: Date | null } | null> {
    const owner = await prisma.owner.findFirst({ where: { id }, select: { name: true, deleted_at: true } });
    return owner ?? null;
  }

  async restore(id: string): Promise<Owner> {
    await prisma.$transaction(async (tx: any) => {
      await tx.owner.update({ where: { id }, data: { deleted_at: null } });
      await tx.contact.updateMany({ where: { owner_id: id }, data: { deleted_at: null } });
      await tx.ownerAddress.updateMany({ where: { owner_id: id }, data: { deleted_at: null } });
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
