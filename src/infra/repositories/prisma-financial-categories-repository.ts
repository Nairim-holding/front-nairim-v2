import prisma from '@/infra/database/prisma';
import type { CategoriesRepository } from '@/core/repositories/financial-categories-repository';
import type {
  Category,
  CreateCategoryData,
  ListCategoriesParams,
  PaginatedCategories,
  UpdateCategoryData,
} from '@/core/entities/category';
import {
  TRANSFER_INFLOW_CATEGORY_NAME,
  TRANSFER_OUTFLOW_CATEGORY_NAME,
  type EnsureTransferCategoriesResult,
} from '@/core/entities/transfer';
import { ConflictError, ForbiddenError, NotFoundError } from '@/core/errors/domain-errors';

/**
 * Implementação Prisma de {@link CategoriesRepository}.
 * Porte fiel de api-nairim-v2/src/services/CategoryService.ts + TransferService
 * (`ensureTransferCategories`).
 *
 * O scoping por empresa é automático (extensão multi-tenant: `Category` está
 * em TENANT_MODELS). A busca em memória considera nome, tipo em pt e status
 * (fiel ao backend); a ordenação usa caminho equivalente (booleano como número,
 * senão localeCompare) e `created_at` desc como default.
 *
 * Camada: infra.
 */
type CategoryRow = Category & { deleted_at: Date | null };

const DIRECT_SORTABLE_FIELDS = ['name', 'type', 'is_active', 'created_at'];

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeSortDirection(direction: string): 'asc' | 'desc' {
  return String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function buildWhere(filters: Record<string, unknown>, includeInactive: boolean): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!includeInactive) where.deleted_at = null;

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'name') {
      where[key] = { contains: String(value), mode: 'insensitive' };
    } else if (key === 'type') {
      where[key] = value;
    } else if (key === 'is_active') {
      where[key] = value === 'true' || value === true;
    }
  });
  return where;
}

function buildOrderBy(sortOptions: Record<string, string>): Record<string, unknown>[] {
  const orderBy: Record<string, unknown>[] = [];
  Object.entries(sortOptions).forEach(([field, direction]) => {
    if (DIRECT_SORTABLE_FIELDS.includes(field)) orderBy.push({ [field]: normalizeSortDirection(direction) });
  });
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
  return orderBy;
}

function filterCategoriesBySearch(categories: CategoryRow[], searchTerm: string): CategoryRow[] {
  if (!searchTerm.trim()) return categories;
  const normalizedSearchTerm = normalizeText(searchTerm);
  return categories.filter((cat) => {
    const typePt = cat.type === 'INCOME' ? 'receita' : cat.type === 'EXPENSE' ? 'despesa' : '';
    const statusPt = cat.is_active ? 'ativo' : 'inativo';
    const fieldsToSearch = [cat.name, typePt, statusPt].join(' ');
    return normalizeText(fieldsToSearch).includes(normalizedSearchTerm);
  });
}

function sortCategories(
  categories: CategoryRow[],
  sortOptions: Record<string, string>,
): CategoryRow[] {
  const entries = Object.entries(sortOptions);
  if (entries.length === 0) {
    return [...categories].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  const field = entries[0][0];
  const direction = normalizeSortDirection(entries[0][1]);
  return [...categories].sort((a, b) => {
    const valA = (a as unknown as Record<string, unknown>)[field];
    const valB = (b as unknown as Record<string, unknown>)[field];
    if (typeof valA === 'boolean' || typeof valB === 'boolean') {
      return direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    }
    const strA = String(valA || '');
    const strB = String(valB || '');
    return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

export class PrismaFinancialCategoriesRepository implements CategoriesRepository {
  async list(params: ListCategoriesParams): Promise<PaginatedCategories> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhere(params.filters, params.includeInactive);

    let categories: CategoryRow[] = [];
    let total = 0;

    if (params.search?.trim()) {
      // Busca em memória: igual ao backend.
      const allCategories = (await prisma.category.findMany({ where: where as never })) as CategoryRow[];
      const filtered = filterCategoriesBySearch(allCategories, params.search ?? '');
      total = filtered.length;
      categories = sortCategories(filtered, params.sortOptions).slice(skip, skip + take);
    } else {
      const [data, count] = await Promise.all([
        prisma.category.findMany({ where: where as never, skip, take, orderBy: buildOrderBy(params.sortOptions) as never }),
        prisma.category.count({ where: where as never }),
      ]);
      categories = data as CategoryRow[];
      total = count;
    }

    return { data: categories, count: total, totalPages: Math.ceil(total / take), currentPage: params.page };
  }

  async getFilters(): Promise<Record<string, unknown>> {
    const categories = await prisma.category.findMany({
      where: { deleted_at: null },
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    const uniqueNames = Array.from(new Set(categories.map((c) => c.name)));
    const nameOptions = uniqueNames.map((name) => ({ label: name, value: name }));

    return {
      filters: [
        {
          field: 'name',
          type: 'select',
          label: 'Nome da Categoria',
          values: nameOptions,
          searchable: true,
        },
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

  async findById(id: string): Promise<Category | null> {
    const category = await prisma.category.findFirst({
      where: { id, deleted_at: null },
      include: { subcategories: { where: { deleted_at: null } } },
    });
    return (category as Category) ?? null;
  }

  async create(data: CreateCategoryData): Promise<Category> {
    // `company_id` é injetado pela extensão multi-tenant a partir do contexto.
    const created = await prisma.category.create({
      data: {
        name: data.name,
        type: data.type,
        is_active: data.is_active ?? true,
        is_system: false,
        // Prisma aceita undefined para não alterar; null grava null.
        dfc_group: data.dfc_group !== undefined ? data.dfc_group : null,
      } as never,
    });
    return created as Category;
  }

  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.dfc_group !== undefined) updateData.dfc_group = data.dfc_group;

    const updated = await prisma.category.update({ where: { id }, data: updateData });
    return updated as Category;
  }

  async softDelete(id: string): Promise<Category> {
    const category = await prisma.category.findFirst({ where: { id, deleted_at: null } });
    if (!category) throw new NotFoundError('Categoria não encontrada ou já excluída');
    if (category.is_system) throw new ForbiddenError('Não é possível excluir categorias internas do sistema.');

    const hasTransactions = await prisma.transaction.findFirst({
      where: { category_id: id, deleted_at: null },
    });
    if (hasTransactions) {
      throw new ConflictError('Não é possível excluir a categoria pois existem lançamentos relacionados.');
    }

    const hasSubcategories = await prisma.subcategory.findFirst({
      where: { category_id: id, deleted_at: null },
    });
    if (hasSubcategories) {
      throw new ConflictError('Não é possível excluir a categoria pois existem subcategorias vinculadas.');
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return updated as Category;
  }

  async findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null> {
    const category = await prisma.category.findFirst({ where: { id }, select: { id: true, deleted_at: true } });
    return category ?? null;
  }

  async restore(id: string): Promise<Category> {
    const updated = await prisma.category.update({
      where: { id },
      data: { deleted_at: null },
    });
    return updated as Category;
  }

  async quickCreate(data: { name: string; type: 'INCOME' | 'EXPENSE' }): Promise<Category> {
    const name = String(data.name ?? '').trim();
    if (!name) throw new Error('Nome é obrigatório');

    const existing = await prisma.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        type: data.type,
        deleted_at: null,
      },
    });
    if (existing) return existing as Category;

    const created = await prisma.category.create({
      data: { name, type: data.type, is_active: true, is_system: false } as never,
    });
    return created as Category;
  }

  async ensureTransferCategories(): Promise<EnsureTransferCategoriesResult> {
    const outflow = await this.findOrCreateSystemCategory(TRANSFER_OUTFLOW_CATEGORY_NAME, 'EXPENSE');
    const inflow = await this.findOrCreateSystemCategory(TRANSFER_INFLOW_CATEGORY_NAME, 'INCOME');
    return { outflow, inflow };
  }

  private async findOrCreateSystemCategory(name: string, type: 'INCOME' | 'EXPENSE'): Promise<Category> {
    let category = await prisma.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        type,
        deleted_at: null,
      },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name,
          type,
          is_system: true,
        } as never,
      });
    }

    return category as Category;
  }
}