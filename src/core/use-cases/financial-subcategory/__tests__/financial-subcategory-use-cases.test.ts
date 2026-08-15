import { describe, it, expect, beforeEach } from 'vitest';
import type { SubcategoriesRepository } from '@/core/repositories/financial-subcategories-repository';
import type {
  CreateSubcategoryData,
  ListSubcategoriesParams,
  PaginatedSubcategories,
  Subcategory,
  UpdateSubcategoryData,
} from '@/core/entities/subcategory';
import {
  CreateSubcategoryUseCase,
  DeleteSubcategoryUseCase,
  GetSubcategoryByIdUseCase,
  QuickCreateSubcategoryUseCase,
  RestoreSubcategoryUseCase,
  UpdateSubcategoryUseCase,
} from '@/core/use-cases/financial-subcategory/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemorySubcategoriesRepository implements SubcategoriesRepository {
  items: (Subcategory & { deleted_at: Date | null })[] = [];
  transactionsBySubcategory: Record<string, number> = {};
  parentCategories: Set<string> = new Set(['cat-1']);

  async list(params: ListSubcategoriesParams): Promise<PaginatedSubcategories> {
    const active = this.items.filter((s) => params.includeInactive || !s.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters() { return { filters: [] }; }
  async findById(id: string) {
    return this.items.find((s) => s.id === id && !s.deleted_at) ?? null;
  }
  async categoryExists(categoryId: string) {
    return this.parentCategories.has(categoryId);
  }
  async create(data: CreateSubcategoryData) {
    const now = new Date();
    const sub = {
      id: `sub-${this.items.length + 1}`, name: data.name, category_id: data.category_id,
      is_active: data.is_active ?? true, company_id: 'c-1', created_at: now, updated_at: now, deleted_at: null,
    } as Subcategory & { deleted_at: Date | null };
    this.items.push(sub);
    return sub;
  }
  async update(id: string, data: UpdateSubcategoryData) {
    const sub = this.items.find((x) => x.id === id)!;
    Object.assign(sub, data);
    return sub;
  }
  async softDelete(id: string) {
    const sub = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!sub) throw new NotFoundError('Subcategoria não encontrada ou já excluída');
    if (this.transactionsBySubcategory[id]) {
      throw new ConflictError('Não é possível excluir a subcategoria pois existem lançamentos relacionados.');
    }
    sub.deleted_at = new Date();
    return sub;
  }
  async findDeletionState(id: string) {
    const sub = this.items.find((x) => x.id === id);
    return sub ? { id: sub.id, deleted_at: sub.deleted_at } : null;
  }
  async restore(id: string) {
    const sub = this.items.find((x) => x.id === id)!;
    sub.deleted_at = null;
    return sub;
  }
  async quickCreate(data: { name: string; category_id: string }) {
    const norm = data.name.toLowerCase();
    const existing = this.items.find(
      (s) => s.name.toLowerCase() === norm && s.category_id === data.category_id && !s.deleted_at,
    );
    if (existing) return existing;
    return this.create(data);
  }
}

function seed(repo: InMemorySubcategoriesRepository, over: Partial<Subcategory> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'sub-1', name: 'Energia', category_id: 'cat-1', is_active: true, company_id: 'c-1',
    created_at: now, updated_at: now, deleted_at: null, ...over,
  } as Subcategory & { deleted_at: Date | null });
}

describe('FinancialSubcategory use-cases', () => {
  let repo: InMemorySubcategoriesRepository;
  beforeEach(() => { repo = new InMemorySubcategoriesRepository(); });

  describe('CreateSubcategoryUseCase', () => {
    it('cria subcategoria', async () => {
      const out = await new CreateSubcategoryUseCase(repo).execute({ name: 'Energia', category_id: 'cat-1' });
      expect(out.name).toBe('Energia');
      expect(out.category_id).toBe('cat-1');
      expect(out.is_active).toBe(true);
    });
    it('rejeita nome vazio (400)', async () => {
      await expect(new CreateSubcategoryUseCase(repo).execute({ name: '  ', category_id: 'cat-1' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita category_id vazio (400)', async () => {
      await expect(new CreateSubcategoryUseCase(repo).execute({ name: 'X', category_id: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança NotFound se a categoria pai não existe', async () => {
      await expect(new CreateSubcategoryUseCase(repo).execute({ name: 'X', category_id: 'ghost' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('UpdateSubcategoryUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateSubcategoryUseCase(repo).execute('ghost', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita nome vazio no update (400)', async () => {
      seed(repo);
      await expect(new UpdateSubcategoryUseCase(repo).execute('sub-1', { name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança 404 se troca para categoria pai inexistente', async () => {
      seed(repo);
      await expect(new UpdateSubcategoryUseCase(repo).execute('sub-1', { category_id: 'ghost' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('atualiza nome sem mexer na categoria (não valida existência)', async () => {
      seed(repo);
      const out = await new UpdateSubcategoryUseCase(repo).execute('sub-1', { name: 'Energia Elétrica' });
      expect(out.name).toBe('Energia Elétrica');
    });
  });

  describe('DeleteSubcategoryUseCase', () => {
    it('lança NotFound se não existe ou já excluído', async () => {
      await expect(new DeleteSubcategoryUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ConflictError se existirem lançamentos relacionados', async () => {
      seed(repo);
      repo.transactionsBySubcategory['sub-1'] = 1;
      await expect(new DeleteSubcategoryUseCase(repo).execute('sub-1')).rejects.toBeInstanceOf(ConflictError);
    });
    it('faz soft-delete', async () => {
      seed(repo);
      await new DeleteSubcategoryUseCase(repo).execute('sub-1');
      expect(repo.items[0].deleted_at).not.toBeNull();
    });
  });

  describe('RestoreSubcategoryUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new RestoreSubcategoryUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestoreSubcategoryUseCase(repo).execute('sub-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura', async () => {
      seed(repo);
      repo.items[0].deleted_at = new Date();
      const out = await new RestoreSubcategoryUseCase(repo).execute('sub-1');
      expect(out.deleted_at).toBeNull();
    });
  });

  describe('GetSubcategoryByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetSubcategoryByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('retorna a subcategoria', async () => {
      seed(repo);
      const out = await new GetSubcategoryByIdUseCase(repo).execute('sub-1');
      expect(out.name).toBe('Energia');
    });
  });

  describe('QuickCreateSubcategoryUseCase', () => {
    it('lança ValidationError sem nome', async () => {
      await expect(new QuickCreateSubcategoryUseCase(repo).execute({ name: '', category_id: 'cat-1' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança ValidationError sem categoria pai', async () => {
      await expect(new QuickCreateSubcategoryUseCase(repo).execute({ name: 'X', category_id: '' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('retorna existente quando nome+categoria coincidem (insensível a caixa)', async () => {
      seed(repo);
      const out = await new QuickCreateSubcategoryUseCase(repo).execute({ name: 'energia', category_id: 'cat-1' });
      expect(out.id).toBe('sub-1');
    });
    it('cria nova quando não existe', async () => {
      const out = await new QuickCreateSubcategoryUseCase(repo).execute({ name: 'Água', category_id: 'cat-1' });
      expect(out.name).toBe('Água');
      expect(out.is_active).toBe(true);
    });
  });
});