import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { SuppliersRepository } from '@/core/repositories/financial-suppliers-repository';
import type {
  CreateSupplierData,
  ListSuppliersParams,
  PaginatedSuppliers,
  Supplier,
  SupplierAddressInput,
  SupplierContactInput,
  UpdateSupplierData,
} from '@/core/entities/financial-supplier';
import { NotFoundError } from '@/core/errors/domain-errors';
import { throwDuplicatedDocument } from '@/core/use-cases/financial-supplier/crud';
import { buildContactCreateData } from './shared/contact-channels';
import { buildDateTimeCondition } from '@/shared/utils/date-utils';

/**
 * Implementação Prisma de {@link SuppliersRepository}.
 * Porte fiel de api-nairim-v2/src/services/SupplierService.ts.
 *
 * Tenant: os GET/DELETE/resenhar do Express NÃO recebiam `company_id`; na
 * migração `Supplier` está em TENANT_MODELS e a extensão injeta `company_id`
 * nas leituras e nos creates (inclusive dentro de `$transaction`, já que a
 * extensão vale para o client transacional). Dup de CNPJ/CPF lança ConflictError
 * (normalização de status do backend: CNPJ já mapeado em 409; CPF caía em 400).
 *
 * Camada: infra.
 */

type SupplierRow = Supplier & {
  addresses?: Array<{ id: string; address_id: string; address?: Record<string, unknown> | null }>;
  contacts?: Array<{ id: string; contact?: string | null; phone?: string | null; cellphone?: string | null; email?: string | null }>;
  deleted_at: Date | null;
};

const FIELD_MAPPING: Record<string, { type: 'direct' | 'address' | 'contact'; realField: string; relationPath?: string }> = {
  legal_name: { type: 'direct', realField: 'legal_name' },
  trade_name: { type: 'direct', realField: 'trade_name' },
  cnpj: { type: 'direct', realField: 'cnpj' },
  cpf: { type: 'direct', realField: 'cpf' },
  state_registration: { type: 'direct', realField: 'state_registration' },
  municipal_registration: { type: 'direct', realField: 'municipal_registration' },
  created_at: { type: 'direct', realField: 'created_at' },
  updated_at: { type: 'direct', realField: 'updated_at' },
  city: { type: 'address', realField: 'city', relationPath: 'addresses.0.address.city' },
  state: { type: 'address', realField: 'state', relationPath: 'addresses.0.address.state' },
  district: { type: 'address', realField: 'district', relationPath: 'addresses.0.address.district' },
  street: { type: 'address', realField: 'street', relationPath: 'addresses.0.address.street' },
  zip_code: { type: 'address', realField: 'zip_code', relationPath: 'addresses.0.address.zip_code' },
  complement: { type: 'address', realField: 'complement', relationPath: 'addresses.0.address.complement' },
  contact_name: { type: 'contact', realField: 'contact', relationPath: 'contacts.0.contact' },
  phone: { type: 'contact', realField: 'phone', relationPath: 'contacts.0.phone' },
  cellphone: { type: 'contact', realField: 'cellphone', relationPath: 'contacts.0.cellphone' },
  email: { type: 'contact', realField: 'email', relationPath: 'contacts.0.email' },
};

const DIRECT_SORTABLE_FIELDS = ['legal_name', 'trade_name', 'cnpj', 'cpf', 'created_at'];
const CONTACT_RELATED_FIELDS = [
  'city', 'state', 'district', 'street', 'zip_code', 'complement',
  'contact_name', 'phone', 'cellphone', 'email',
];

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeSortDirection(direction: string): 'asc' | 'desc' {
  return String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function safeGetProperty(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce((acc: unknown, part) => (acc && (acc as Record<string, unknown>)[part] !== undefined ? (acc as Record<string, unknown>)[part] : undefined), obj);
}

function buildFilterConditions(filters: Record<string, unknown>): Record<string, unknown> {
  const conditions: Record<string, unknown> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (['legal_name', 'trade_name', 'cnpj', 'cpf', 'state_registration', 'municipal_registration'].includes(key)) {
      conditions[key] = { contains: String(value), mode: 'insensitive' };
    } else if (['city', 'state', 'zip_code', 'street', 'district', 'complement'].includes(key)) {
      if (!conditions.addresses) conditions.addresses = { some: { address: {} } };
      (conditions.addresses as Record<string, unknown>).some = {
        address: { [key]: { contains: String(value), mode: 'insensitive' } },
      };
    } else if (key === 'contact_name') {
      if (!conditions.contacts) conditions.contacts = { some: {} };
      (conditions.contacts as Record<string, unknown>).some = { contact: { contains: String(value), mode: 'insensitive' } };
    } else if (['phone', 'cellphone', 'email'].includes(key)) {
      if (!conditions.contacts) conditions.contacts = { some: {} };
      (conditions.contacts as Record<string, unknown>).some = { [key]: { contains: String(value), mode: 'insensitive' } };
    } else if (key === 'created_at') {
      conditions.created_at = buildDateTimeCondition(value);
    }
  });

  return conditions;
}

function filterSuppliersBySearch(suppliers: SupplierRow[], searchTerm: string): SupplierRow[] {
  if (!searchTerm.trim()) return suppliers;
  const normalizedSearch = normalizeText(searchTerm);

  return suppliers.filter((supplier) => {
    const directFields = [
      supplier.legal_name,
      supplier.trade_name,
      supplier.cnpj,
      supplier.cpf,
      supplier.state_registration,
      supplier.municipal_registration,
    ]
      .filter(Boolean)
      .join(' ');

    const addressFields =
      supplier.addresses
        ?.map((sa) => sa.address)
        .filter(Boolean)
        .map(
          (addr) =>
            [addr?.street, addr?.district, addr?.city, addr?.state, addr?.zip_code, addr?.complement]
              .filter(Boolean)
              .join(' '),
        )
        .join(' ') || '';

    const contactFields =
      supplier.contacts
        ?.map((c) => [c.contact, c.phone, c.cellphone, c.email].filter(Boolean).join(' '))
        .join(' ') || '';

    const allFields = [directFields, addressFields, contactFields].join(' ');
    return normalizeText(allFields).includes(normalizedSearch);
  });
}

function sortSuppliers(suppliers: SupplierRow[], sortOptions: Record<string, string>): SupplierRow[] {
  const sortField = Object.keys(sortOptions)[0];
  const sortDirection = sortField ? normalizeSortDirection(sortOptions[sortField]) : 'desc';

  if (!sortField) {
    return [...suppliers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return [...suppliers].sort((a, b) => {
    const fieldInfo = FIELD_MAPPING[sortField];
    let valA: unknown;
    let valB: unknown;

    if (fieldInfo?.relationPath) {
      valA = safeGetProperty(a, fieldInfo.relationPath);
      valB = safeGetProperty(b, fieldInfo.relationPath);
    } else {
      valA = (a as unknown as Record<string, unknown>)[sortField];
      valB = (b as unknown as Record<string, unknown>)[sortField];
    }

    const strA = normalizeText(String(valA || ''));
    const strB = normalizeText(String(valB || ''));
    return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

const SUPPLIER_INCLUDE = {
  addresses: { where: { deleted_at: null }, include: { address: true } },
  contacts: { where: { deleted_at: null }, include: { channels: { where: { deleted_at: null }, orderBy: { display_order: 'asc' as const } } } },
};

export class PrismaFinancialSuppliersRepository implements SuppliersRepository {
  async list(params: ListSuppliersParams): Promise<PaginatedSuppliers> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;

    const where: Record<string, unknown> = {};
    if (!params.includeInactive) where.deleted_at = null;

    const filterConditions = buildFilterConditions(params.filters);
    if (Object.keys(filterConditions).length > 0) {
      where.AND = [filterConditions];
    }

    const sortField = Object.keys(params.sortOptions)[0];
    const sortDirection = sortField ? normalizeSortDirection(params.sortOptions[sortField]) : 'desc';

    let suppliersData: SupplierRow[] = [];
    let total = 0;

    if ((params.search?.trim() ?? '') || (sortField && CONTACT_RELATED_FIELDS.includes(sortField))) {
      const allSuppliers = (await prisma.supplier.findMany({
        where: where as never,
        include: SUPPLIER_INCLUDE,
      })) as unknown as SupplierRow[];

      const filtered = filterSuppliersBySearch(allSuppliers, params.search ?? '');
      total = filtered.length;
      suppliersData = sortSuppliers(filtered, params.sortOptions).slice(skip, skip + take);
    } else {
      const orderBy: Record<string, unknown>[] = [];
      if (sortField && DIRECT_SORTABLE_FIELDS.includes(sortField)) {
        orderBy.push({ [sortField]: sortDirection });
      } else {
        orderBy.push({ created_at: 'desc' });
      }

      const [data, count] = await Promise.all([
        prisma.supplier.findMany({
          where: where as never,
          skip,
          take,
          orderBy: orderBy as never,
          include: SUPPLIER_INCLUDE,
        }),
        prisma.supplier.count({ where: where as never }),
      ]);
      suppliersData = data as unknown as SupplierRow[];
      total = count;
    }

    return {
      data: suppliersData as Supplier[],
      count: total,
      totalPages: Math.ceil(total / take),
      currentPage: params.page,
    };
  }

  async getFilters(): Promise<Record<string, unknown>> {
    const [suppliers, addresses, contacts, dateRange] = await Promise.all([
      prisma.supplier.findMany({
        where: { deleted_at: null },
        select: {
          legal_name: true, trade_name: true, cnpj: true, cpf: true,
          state_registration: true, municipal_registration: true,
        },
        distinct: ['legal_name', 'trade_name', 'cnpj', 'cpf', 'state_registration', 'municipal_registration'],
      }),
      prisma.address.findMany({
        where: { deleted_at: null, supplierAddresses: { some: { supplier: { deleted_at: null } } } },
        select: { city: true, state: true, district: true, street: true, zip_code: true, complement: true },
        distinct: ['city', 'state', 'district', 'street', 'zip_code', 'complement'],
      }),
      prisma.contact.findMany({
        where: { deleted_at: null, supplier_id: { not: null }, supplier: { deleted_at: null } },
        select: { contact: true, phone: true, cellphone: true, email: true },
        distinct: ['contact', 'phone', 'cellphone', 'email'],
      }),
      prisma.supplier.aggregate({
        where: { deleted_at: null },
        _min: { created_at: true },
        _max: { created_at: true },
      }),
    ]);

    const unique = (values: (string | null | undefined)[]): string[] =>
      Array.from(new Set(values.map((v) => v || '').filter(Boolean))).sort();

    return {
      filters: [
        { field: 'legal_name', type: 'string', label: 'Nome / Razão Social', values: unique(suppliers.map((s) => s.legal_name)), searchable: true },
        { field: 'trade_name', type: 'string', label: 'Nome Fantasia', values: unique(suppliers.map((s) => s.trade_name)), searchable: true },
        { field: 'cnpj', type: 'string', label: 'CNPJ', values: unique(suppliers.map((s) => s.cnpj)), searchable: true },
        { field: 'cpf', type: 'string', label: 'CPF', values: unique(suppliers.map((s) => s.cpf)), searchable: true },
        { field: 'state_registration', type: 'string', label: 'Inscrição Estadual', values: unique(suppliers.map((s) => s.state_registration)), searchable: true },
        { field: 'municipal_registration', type: 'string', label: 'Inscrição Municipal', values: unique(suppliers.map((s) => s.municipal_registration)), searchable: true },
        { field: 'city', type: 'string', label: 'Cidade', values: unique(addresses.map((a) => a.city)), searchable: true },
        { field: 'state', type: 'string', label: 'Estado', values: unique(addresses.map((a) => a.state)), searchable: true },
        { field: 'district', type: 'string', label: 'Bairro', values: unique(addresses.map((a) => a.district)), searchable: true },
        { field: 'street', type: 'string', label: 'Rua', values: unique(addresses.map((a) => a.street)), searchable: true },
        { field: 'zip_code', type: 'string', label: 'CEP', values: unique(addresses.map((a) => a.zip_code)), searchable: true },
        { field: 'complement', type: 'string', label: 'Complemento', values: unique(addresses.map((a) => a.complement)), searchable: true },
        { field: 'contact_name', type: 'string', label: 'Nome do Contato', values: unique(contacts.map((c) => c.contact)), searchable: true },
        { field: 'phone', type: 'string', label: 'Telefone', values: unique(contacts.map((c) => c.phone)), searchable: true },
        { field: 'cellphone', type: 'string', label: 'Celular', values: unique(contacts.map((c) => c.cellphone)), searchable: true },
        { field: 'email', type: 'string', label: 'E-mail', values: unique(contacts.map((c) => c.email)), searchable: true },
        {
          field: 'created_at',
          type: 'date',
          label: 'Criado em',
          min: dateRange._min.created_at?.toISOString().split('T')[0],
          max: dateRange._max.created_at?.toISOString().split('T')[0],
          dateRange: true,
        },
      ],
      operators: {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        select: ['equals', 'in'],
      },
      defaultSort: 'created_at:desc',
      searchFields: ['legal_name', 'trade_name', 'cnpj', 'cpf', 'city', 'state', 'contact_name', 'phone', 'cellphone', 'email'],
    };
  }

  async findById(id: string): Promise<Supplier | null> {
    const supplier = await prisma.supplier.findFirst({
      where: { id, deleted_at: null },
      include: SUPPLIER_INCLUDE,
    });
    return (supplier as unknown as Supplier) ?? null;
  }

  async create(data: CreateSupplierData): Promise<Supplier> {
    // `tx` (dentro de $transaction) não passa pela extensão multi-tenant —
    // company_id precisa ser injetado explicitamente, e os findFirst de
    // duplicidade precisam do filtro manual (senão checam CNPJ/CPF único
    // globalmente em vez de por empresa).
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Contexto de empresa não identificado.');

    const created = await prisma.$transaction(async (tx: any) => {
      if (data.cnpj) {
        const existing = await tx.supplier.findFirst({ where: { cnpj: data.cnpj, company_id: companyId, deleted_at: null } });
        if (existing) throwDuplicatedDocument('cnpj', 'create');
      }
      if (data.cpf) {
        const existing = await tx.supplier.findFirst({ where: { cpf: data.cpf, company_id: companyId, deleted_at: null } });
        if (existing) throwDuplicatedDocument('cpf', 'create');
      }

      const newSupplier = await tx.supplier.create({
        data: {
          company_id: companyId,
          legal_name: data.legal_name,
          trade_name: data.trade_name,
          cnpj: data.cnpj,
          cpf: data.cpf,
          internal_code: data.internal_code,
          occupation: data.occupation,
          marital_status: data.marital_status,
          state_registration: data.state_registration,
          municipal_registration: data.municipal_registration,
        } as never,
      });

      await this.createContacts(tx, newSupplier.id, data.contacts);
      await this.createAddresses(tx, newSupplier.id, data.addresses);

      return newSupplier;
    });

    return (await this.findById(created.id)) as Supplier;
  }

  async update(id: string, data: UpdateSupplierData): Promise<Supplier> {
    await prisma.$transaction(async (tx: any) => {
      const existing = await tx.supplier.findFirst({ where: { id, deleted_at: null } });
      if (!existing) throw new NotFoundError('Fornecedor não encontrado');

      if (data.cnpj && data.cnpj !== existing.cnpj) {
        const cnpjExists = await tx.supplier.findFirst({ where: { cnpj: data.cnpj, NOT: { id }, deleted_at: null } });
        if (cnpjExists) throwDuplicatedDocument('cnpj', 'update');
      }
      if (data.cpf && data.cpf !== existing.cpf) {
        const cpfExists = await tx.supplier.findFirst({ where: { cpf: data.cpf, NOT: { id }, deleted_at: null } });
        if (cpfExists) throwDuplicatedDocument('cpf', 'update');
      }

      const updateData: Record<string, unknown> = {};
      if (data.legal_name !== undefined) updateData.legal_name = data.legal_name;
      if (data.trade_name !== undefined) updateData.trade_name = data.trade_name;
      if (data.cnpj !== undefined) updateData.cnpj = data.cnpj;
      if (data.cpf !== undefined) updateData.cpf = data.cpf;
      if (data.internal_code !== undefined) updateData.internal_code = data.internal_code;
      if (data.occupation !== undefined) updateData.occupation = data.occupation;
      if (data.marital_status !== undefined) updateData.marital_status = data.marital_status;
      if (data.state_registration !== undefined) updateData.state_registration = data.state_registration;
      if (data.municipal_registration !== undefined) updateData.municipal_registration = data.municipal_registration;

      await tx.supplier.update({ where: { id }, data: updateData });

      if (data.contacts !== undefined) {
        await tx.contact.updateMany({
          where: { supplier_id: id, deleted_at: null },
          data: { deleted_at: new Date() },
        });
        await this.createContacts(tx, id, data.contacts);
      }

      if (data.addresses !== undefined) {
        await tx.supplierAddress.updateMany({
          where: { supplier_id: id, deleted_at: null },
          data: { deleted_at: new Date() },
        });
        await this.createAddresses(tx, id, data.addresses);
      }
    });

    return (await this.findById(id)) as Supplier;
  }

  async softDelete(id: string): Promise<Supplier> {
    const updated = await prisma.$transaction(async (tx: any) => {
      const supplier = await tx.supplier.findFirst({ where: { id, deleted_at: null } });
      if (!supplier) throw new NotFoundError('Fornecedor não encontrado ou já excluído');

      return tx.supplier.update({
        where: { id },
        data: {
          deleted_at: new Date(),
          contacts: { updateMany: { where: { supplier_id: id }, data: { deleted_at: new Date() } } },
          addresses: { updateMany: { where: { supplier_id: id }, data: { deleted_at: new Date() } } },
        },
      });
    });
    return updated as Supplier;
  }

  async findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null> {
    const supplier = await prisma.supplier.findFirst({ where: { id }, select: { id: true, deleted_at: true } });
    return supplier ?? null;
  }

  async restore(id: string): Promise<Supplier> {
    await prisma.$transaction(async (tx: any) => {
      await tx.supplier.update({
        where: { id },
        data: {
          deleted_at: null,
          contacts: { updateMany: { where: { supplier_id: id }, data: { deleted_at: null } } },
          addresses: { updateMany: { where: { supplier_id: id }, data: { deleted_at: null } } },
        },
      });
    });
    return (await this.findById(id)) as Supplier;
  }

  async quickCreate(data: { legal_name: string }): Promise<Supplier> {
    const legalName = String(data.legal_name ?? '').trim();

    if (legalName.length < 2 || legalName.length > 150) {
      throw new NotFoundError('legal_name é obrigatório e deve ter entre 2 e 150 caracteres.');
    }

    const existing = await prisma.supplier.findFirst({
      where: { legal_name: { equals: legalName, mode: 'insensitive' }, deleted_at: null },
    });
    if (existing) return existing as Supplier;

    const existingCodes = await prisma.supplier.findMany({
      where: { deleted_at: null, internal_code: { not: null } },
      select: { internal_code: true },
    });

    let maxCode = 0;
    for (const s of existingCodes) {
      if (s.internal_code && /^\d+$/.test(s.internal_code)) {
        const n = parseInt(s.internal_code, 10);
        if (n > maxCode) maxCode = n;
      }
    }

    const MAX_ATTEMPTS = 5;
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < MAX_ATTEMPTS) {
      const candidateCode = String(maxCode + 1 + attempt);
      try {
        const created = await prisma.supplier.create({
          data: {
            legal_name: legalName,
            internal_code: candidateCode,
            created_via: 'quick_create',
            is_active: true,
          } as never,
        });
        return (await this.findById(created.id)) as Supplier;
      } catch (error: any) {
        lastError = error;
        if (error.code === 'P2002') {
          attempt++;
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  private async createContacts(
    tx: any,
    supplierId: string,
    contacts?: SupplierContactInput[],
  ): Promise<void> {
    for (const contact of contacts ?? []) {
      await tx.contact.create({ data: buildContactCreateData(contact, { supplier_id: supplierId }) });
    }
  }

  private async createAddresses(
    tx: any,
    supplierId: string,
    addresses?: SupplierAddressInput[],
  ): Promise<void> {
    for (const addr of addresses ?? []) {
      const newAddress = await tx.address.create({
        data: { ...addr, country: addr.country || 'Brasil' },
      });
      await tx.supplierAddress.create({
        data: { supplier_id: supplierId, address_id: newAddress.id },
      });
    }
  }
}
