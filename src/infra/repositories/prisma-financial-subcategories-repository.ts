import prisma from '@/infra/database/prisma';
import type { SubcategoriesRepository } from '@/core/repositories/financial-subcategories-repository';
import type {
  CreateSubcategoryData,
  ListSubcategoriesParams,
  PaginatedSubcategories,
  Subcategory,
  UpdateSubcategoryData,
} from '@/core/entities/subcategory';
import { ConflictError, NotFoundError } from '@/core/errors/domain-errors';

/**
 * Implementação Prisma de {@link SubcategoriesRepository}.
 * Porte fiel de api-nairim-v2/src/services/SubcategoryService.ts.
 *
 * DIVERGÊNCIA INTENCIONAL de tenant: o `getSubcategories` do Express não
 * recebia `company_id` (leitura NÃO escopada). Aqui `Subcategory` está em
 * TENANT_MODELS e a extensão multi-tenant injeta `company_id` automaticamente
 * — leitura escopada à empresa, consistente com os demais endpoints do menu
 * financeiro. A busca em memória inclui o nome da categoria pai e o tipo em pt
 * (receita/despesa), fiel ao backend.
 *
 * Camada: infra.
 */

type SubcategoryRow = Subcategory & { deleted_at: Date | null };

const DIRECT_SORTABLE_FIELDS = ['name', 'is_active', 'created_at'];

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
    .reduce<unknown>((acc, part) => {
      const current = acc as Record<string, unknown> | null | undefined;
      return current && current[part] !== undefined ? current[part] : undefined;
    }, obj);
}

function buildWhere(filters: Record<string, unknown>, includeInactive: boolean): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!includeInactive) where.deleted_at = null;

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'name') {
      where[key] = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'category_id') {
      where[key] = String(value);
    } else if (key === 'is_active') {
      where[key] = value === 'true' || value === true;
    }
  });
  return where;
}

function buildOrderBy(sortOptions: Record<string, string>): Record<string, unknown>[] {
  const orderBy: Record<string, unknown>[] = [];
  Object.entries(sortOptions).forEach(([field, direction]) => {
    const dir = normalizeSortDirection(direction);
    if (DIRECT_SORTABLE_FIELDS.includes(field)) {
      orderBy.push({ [field]: dir });
    } else if (field === 'category_id') {
      orderBy.push({ category: { name: dir } });
    }
  });
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
  return orderBy;
}

function filterSubcategoriesBySearch(subcategories: SubcategoryRow[], searchTerm: string): SubcategoryRow[] {
  if (!searchTerm.trim()) return subcategories;
  const normalizedSearchTerm = normalizeText(searchTerm);

  return subcategories.filter((sub) => {
    const statusPt = sub.is_active ? 'ativo' : 'inativo';
    const typePt = sub.category?.type === 'INCOME' ? 'receita' : sub.category?.type === 'EXPENSE' ? 'despesa' : '';
    const fieldsToSearch = [sub.name, sub.category?.name, typePt, statusPt].filter(Boolean).join(' ');
    return normalizeText(fieldsToSearch).includes(normalizedSearchTerm);
  });
}

function sortSubcategories(subcategories: SubcategoryRow[], sortOptions: Record<string, string>): SubcategoryRow[] {
  const entries = Object.entries(sortOptions);
  if (entries.length === 0) {
    return [...subcategories].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const field = entries[0][0];
  const direction = normalizeSortDirection(entries[0][1]);
  return [...subcategories].sort((a, b) => {
    const realField = field === 'category_id' ? 'category.name' : field;
    let valA = safeGetProperty(a, realField);
    let valB = safeGetProperty(b, realField);
    if (valA === undefined) valA = (a as unknown as Record<string, unknown>)[field];
    if (valB === undefined) valB = (b as unknown as Record<string, unknown>)[field];

    if (typeof valA === 'boolean' || typeof valB === 'boolean') {
      return direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    }
    const strA = normalizeText(String(valA || ''));
    const strB = normalizeText(String(valB || ''));
    return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

export class PrismaFinancialSubcategoriesRepository implements SubcategoriesRepository {
  async list(params: ListSubcategoriesParams): Promise<PaginatedSubcategories> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters, params.includeInactive);

    let subcategories: SubcategoryRow[] = [];
    let total = 0;

    if (params.search?.trim()) {
      // Busca em memória: igual ao backend.
      const allSubcategories = (await prisma.subcategory.findMany({
        where: where as never,
        include: { category: true },
      })) as SubcategoryRow[];
      const filtered = filterSubcategoriesBySearch(allSubcategories, params.search ?? '');
      total = filtered.length;
      subcategories = sortSubcategories(filtered, params.sortOptions).slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.subcategory.findMany({
          where: where as never,
          skip,
          take,
          orderBy: buildOrderBy(params.sortOptions) as never,
          include: { category: true },
        }),
        prisma.subcategory.count({ where: where as never }),
      ]);
      subcategories = data as SubcategoryRow[];
      total = count;
    }

    return { data: subcategories, count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(): Promise<Record<string, unknown>> {
    const [subcategories, categories] = await Promise.all([
      prisma.subcategory.findMany({ where: { deleted_at: null }, select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.category.findMany({ where: { deleted_at: null }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } }),
    ]);

    const uniqueNames = Array.from(new Set(subcategories.map((s) => s.name)));
    const nameOptions = uniqueNames.map((name) => ({ label: name, value: name }));
    const categoryOptions = categories.map((c) => {
      const tipoTraduzido = c.type === 'INCOME' ? 'Receita' : 'Despesa';
      return { label: `${c.name} (${tipoTraduzido})`, value: c.id };
    });

    return {
      filters: [
        {
          field: 'name',
          type: 'select',
          label: 'Nome da Subcategoria',
          values: nameOptions,
          searchable: true,
        },
        { field: 'category_id', type: 'select', label: 'Categoria Pai', values: categoryOptions },
        {
          field: 'is_active',
          type: 'select',
          label: 'Status',
          values: [
            { label: 'Ativo', value: 'true' },
            { label: 'Inativo', value: 'false' },
          ],
        },
      ],
      defaultSort: 'created_at:desc',
      searchFields: ['name'],
    };
  }

  async findById(id: string): Promise<Subcategory | null> {
    const subcategory = await prisma.subcategory.findUnique({
      where: { id, deleted_at: null },
      include: { category: true },
    });
    return (subcategory as Subcategory) ?? null;
  }

  async categoryExists(categoryId: string): Promise<boolean> {
    return !!(await prisma.category.findFirst({ where: { id: categoryId, deleted_at: null }, select: { id: true } }));
  }

  async create(data: CreateSubcategoryData): Promise<Subcategory> {
    // `company_id` é injetado pela extensão multi-tenant a partir do contexto.
    const created = await prisma.subcategory.create({
      data: {
        name: data.name,
        category_id: data.category_id,
        is_active: data.is_active ?? true,
      } as never,
    });
    return created as Subcategory;
  }

  async update(id: string, data: UpdateSubcategoryData): Promise<Subcategory> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category_id !== undefined) updateData.category_id = data.category_id;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const updated = await prisma.subcategory.update({ where: { id }, data: updateData });
    return updated as Subcategory;
  }

  async softDelete(id: string): Promise<Subcategory> {
    const subcategory = await prisma.subcategory.findUnique({ where: { id, deleted_at: null } });
    if (!subcategory) throw new NotFoundError('Subcategoria não encontrada ou já excluída');

    const hasTransactions = await prisma.transaction.findFirst({
      where: { subcategory_id: id, deleted_at: null },
    });
    if (hasTransactions) {
      throw new ConflictError('Não é possível excluir a subcategoria pois existem lançamentos relacionados.');
    }

    const updated = await prisma.subcategory.update({ where: { id }, data: { deleted_at: new Date() } });
    return updated as Subcategory;
  }

  async findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null> {
    const subcategory = await prisma.subcategory.findUnique({ where: { id }, select: { id: true, deleted_at: true } });
    return subcategory ?? null;
  }

  async restore(id: string): Promise<Subcategory> {
    const updated = await prisma.subcategory.update({ where: { id }, data: { deleted_at: null } });
    return updated as Subcategory;
  }

  async quickCreate(data: { name: string; category_id: string }): Promise<Subcategory> {
    const name = String(data.name ?? '').trim();
    const categoryId = String(data.category_id ?? '').trim();
    if (!name) throw new Error('Nome é obrigatório');
    if (!categoryId) throw new Error('Categoria pai é obrigatória');

    const existing = await prisma.subcategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, category_id: categoryId, deleted_at: null },
    });
    if (existing) return existing as Subcategory;

    const created = await prisma.subcategory.create({
      data: { name, category_id: categoryId, is_active: true } as never,
    });
    return created as Subcategory;
  }
}