import { describe, it, expect, beforeEach } from 'vitest';
import type { CategoriesRepository } from '@/core/repositories/financial-categories-repository';
import type {
  Category,
  CreateCategoryData,
  ListCategoriesParams,
  PaginatedCategories,
  UpdateCategoryData,
} from '@/core/entities/category';
import {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  GetCategoryByIdUseCase,
  ListCategoriesUseCase,
  QuickCreateCategoryUseCase,
  RestoreCategoryUseCase,
  UpdateCategoryUseCase,
} from '@/core/use-cases/financial-category/crud';
import { EnsureTransferCategoriesUseCase } from '@/core/use-cases/transfer/ensure-categories';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemoryCategoriesRepository implements CategoriesRepository {
  items: (Category & { deleted_at: Date | null })[] = [];
  transactionsByCategory: Record<string, number> = {};
  subcategoriesByCategory: Record<string, number> = {};
  ensureCalled = false;

  async list(params: ListCategoriesParams): Promise<PaginatedCategories> {
    const active = this.items.filter((c) => params.includeInactive || !c.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters() { return { filters: [] }; }
  async findById(id: string) {
    return this.items.find((c) => c.id === id && !c.deleted_at) ?? null;
  }
  async create(data: CreateCategoryData) {
    const now = new Date();
    const cat = {
      id: `cat-${this.items.length + 1}`, name: data.name, type: data.type,
      is_active: data.is_active ?? true, is_system: false,
      dfc_group: data.dfc_group && data.dfc_group !== null ? data.dfc_group : null,
      company_id: 'c-1', created_at: now, updated_at: now, deleted_at: null,
    } as Category & { deleted_at: Date | null };
    this.items.push(cat);
    return cat;
  }
  async update(id: string, data: UpdateCategoryData) {
    const cat = this.items.find((x) => x.id === id)!;
    Object.assign(cat, data);
    return cat;
  }
  async softDelete(id: string) {
    const cat = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!cat) throw new NotFoundError('Categoria não encontrada ou já excluída');
    if (cat.is_system) throw new ForbiddenError('Não é possível excluir categorias internas do sistema.');
    if (this.transactionsByCategory[id]) {
      throw new ConflictError('Não é possível excluir a categoria pois existem lançamentos relacionados.');
    }
    if (this.subcategoriesByCategory[id]) {
      throw new ConflictError('Não é possível excluir a categoria pois existem subcategorias vinculadas.');
    }
    cat.deleted_at = new Date();
    return cat;
  }
  async findDeletionState(id: string) {
    const cat = this.items.find((x) => x.id === id);
    return cat ? { id: cat.id, deleted_at: cat.deleted_at } : null;
  }
  async restore(id: string) {
    const cat = this.items.find((x) => x.id === id)!;
    cat.deleted_at = null;
    return cat;
  }
  async quickCreate(data: { name: string; type: 'INCOME' | 'EXPENSE' }) {
    const norm = data.name.toLowerCase();
    const existing = this.items.find(
      (c) => c.name.toLowerCase() === norm && c.type === data.type && !c.deleted_at,
    );
    if (existing) return existing;
    return this.create(data);
  }
  async ensureTransferCategories() {
    this.ensureCalled = true;
    const outflow = { id: 'outflow-1', name: 'Transferência entre Contas – Saída', type: 'EXPENSE' as const, is_active: true, is_system: true, dfc_group: null, company_id: 'c-1', created_at: new Date(), updated_at: new Date(), deleted_at: null };
    const inflow = { id: 'inflow-1', name: 'Transferência entre Contas – Entrada', type: 'INCOME' as const, is_active: true, is_system: true, dfc_group: null, company_id: 'c-1', created_at: new Date(), updated_at: new Date(), deleted_at: null };
    this.items.push(outflow as Category & { deleted_at: Date | null });
    this.items.push(inflow as Category & { deleted_at: Date | null });
    return { outflow, inflow };
  }
}

function seed(repo: InMemoryCategoriesRepository, over: Partial<Category> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'cat-1', name: 'Aluguel', type: 'EXPENSE', is_active: true, is_system: false,
    dfc_group: null, company_id: 'c-1', created_at: now, updated_at: now, deleted_at: null, ...over,
  } as Category & { deleted_at: Date | null });
}

describe('FinancialCategory use-cases', () => {
  let repo: InMemoryCategoriesRepository;
  beforeEach(() => { repo = new InMemoryCategoriesRepository(); });

  describe('CreateCategoryUseCase', () => {
    it('cria categoria (EXPENSE, is_active default e is_system false)', async () => {
      const out = await new CreateCategoryUseCase(repo).execute({ name: 'Alimentação', type: 'EXPENSE' });
      expect(out.name).toBe('Alimentação');
      expect(out.is_active).toBe(true);
      expect(out.is_system).toBe(false);
    });
    it('rejeita nome vazio (400)', async () => {
      await expect(new CreateCategoryUseCase(repo).execute({ name: '  ', type: 'EXPENSE' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita tipo inválido (400)', async () => {
      await expect(new CreateCategoryUseCase(repo).execute({ name: 'X', type: 'FOO' as never })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita dfc_group inválido (400)', async () => {
      await expect(new CreateCategoryUseCase(repo).execute({ name: 'X', type: 'EXPENSE', dfc_group: 'BLA' as never })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('UpdateCategoryUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateCategoryUseCase(repo).execute('ghost', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita nome vazio no update (400)', async () => {
      seed(repo);
      await expect(new UpdateCategoryUseCase(repo).execute('cat-1', { name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('bloqueia edição de categoria interna do sistema (403)', async () => {
      seed(repo, { is_system: true });
      await expect(new UpdateCategoryUseCase(repo).execute('cat-1', { name: 'X' })).rejects.toBeInstanceOf(ForbiddenError);
    });
    it('atualiza campos (inclui dfc_group)', async () => {
      seed(repo);
      const out = await new UpdateCategoryUseCase(repo).execute('cat-1', { name: 'Alugado', dfc_group: 'FIXED_EXPENSE' });
      expect(out.name).toBe('Alugado');
      expect(out.dfc_group).toBe('FIXED_EXPENSE');
    });
  });

  describe('DeleteCategoryUseCase', () => {
    it('lança NotFound se não existe ou já excluído', async () => {
      await expect(new DeleteCategoryUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ForbiddenError se for categoria interna do sistema', async () => {
      seed(repo, { is_system: true });
      await expect(new DeleteCategoryUseCase(repo).execute('cat-1')).rejects.toBeInstanceOf(ForbiddenError);
    });
    it('lança ConflictError se existirem lançamentos relacionados', async () => {
      seed(repo);
      repo.transactionsByCategory['cat-1'] = 1;
      await expect(new DeleteCategoryUseCase(repo).execute('cat-1')).rejects.toBeInstanceOf(ConflictError);
    });
    it('lança ConflictError se existirem subcategorias vinculadas', async () => {
      seed(repo);
      repo.subcategoriesByCategory['cat-1'] = 1;
      await expect(new DeleteCategoryUseCase(repo).execute('cat-1')).rejects.toBeInstanceOf(ConflictError);
    });
    it('faz soft-delete', async () => {
      seed(repo);
      await new DeleteCategoryUseCase(repo).execute('cat-1');
      expect(repo.items[0].deleted_at).not.toBeNull();
    });
  });

  describe('RestoreCategoryUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new RestoreCategoryUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestoreCategoryUseCase(repo).execute('cat-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura', async () => {
      seed(repo);
      repo.items[0].deleted_at = new Date();
      const out = await new RestoreCategoryUseCase(repo).execute('cat-1');
      expect(out.deleted_at).toBeNull();
    });
  });

  describe('GetCategoryByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetCategoryByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('retorna a categoria', async () => {
      seed(repo);
      const out = await new GetCategoryByIdUseCase(repo).execute('cat-1');
      expect(out.name).toBe('Aluguel');
    });
  });

  describe('QuickCreateCategoryUseCase', () => {
    it('lança ValidationError sem nome', async () => {
      await expect(new QuickCreateCategoryUseCase(repo).execute({ name: '', type: 'EXPENSE' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança ValidationError com tipo inválido', async () => {
      await expect(new QuickCreateCategoryUseCase(repo).execute({ name: 'X', type: 'FOO' as never })).rejects.toBeInstanceOf(ValidationError);
    });
    it('retorna existente quando o nome+tipo coincide (insensível a caixa)', async () => {
      seed(repo);
      const out = await new QuickCreateCategoryUseCase(repo).execute({ name: 'aluguel', type: 'EXPENSE' });
      expect(out.id).toBe('cat-1');
    });
    it('cria nova quando não existe', async () => {
      const out = await new QuickCreateCategoryUseCase(repo).execute({ name: 'Receita Extra', type: 'INCOME' });
      expect(out.name).toBe('Receita Extra');
      expect(out.type).toBe('INCOME');
    });
  });

  describe('ListCategoriesUseCase + EnsureTransferCategories', () => {
    it('chama ensureTransferCategories antes de listar (fiel ao backend)', async () => {
      await new ListCategoriesUseCase(repo).execute({
        limit: 30, page: 1, search: '', filters: {}, sortOptions: {}, includeInactive: false,
      });
      expect(repo.ensureCalled).toBe(true);
    });
    it('EnsureTransferCategoriesUseCase delega ao repositório', async () => {
      const res = await new EnsureTransferCategoriesUseCase(repo).execute();
      expect(res.outflow.name).toBe('Transferência entre Contas – Saída');
      expect(res.inflow.name).toBe('Transferência entre Contas – Entrada');
    });
  });
});