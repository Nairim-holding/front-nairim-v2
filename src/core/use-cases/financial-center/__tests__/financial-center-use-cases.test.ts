import { describe, it, expect, beforeEach } from 'vitest';
import type { CentersRepository } from '@/core/repositories/financial-centers-repository';
import type {
  Center,
  CreateCenterData,
  ListCentersParams,
  PaginatedCenters,
  UpdateCenterData,
} from '@/core/entities/financial-center';
import {
  CreateCenterUseCase,
  DeleteCenterUseCase,
  GetCenterByIdUseCase,
  GetCenterFiltersUseCase,
  ListCentersUseCase,
  QuickCreateCenterUseCase,
  RestoreCenterUseCase,
  UpdateCenterUseCase,
} from '@/core/use-cases/financial-center/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemoryCentersRepository implements CentersRepository {
  items: (Center & { deleted_at: Date | null })[] = [];
  transactionsByCenter: Record<string, number> = {};

  async list(params: ListCentersParams): Promise<PaginatedCenters> {
    const active = this.items.filter((c) => params.includeInactive || !c.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters() { return { filters: [] }; }
  async findById(id: string) {
    return this.items.find((c) => c.id === id && !c.deleted_at) ?? null;
  }
  async create(data: CreateCenterData) {
    const now = new Date();
    const center = {
      id: `center-${this.items.length + 1}`, name: data.name, type: data.type,
      is_active: data.is_active ?? true, company_id: 'c-1',
      created_at: now, updated_at: now, deleted_at: null,
    } as Center & { deleted_at: Date | null };
    this.items.push(center);
    return center;
  }
  async update(id: string, data: UpdateCenterData) {
    const center = this.items.find((x) => x.id === id)!;
    Object.assign(center, data);
    return center;
  }
  async softDelete(id: string) {
    const center = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!center) throw new NotFoundError('Centro não encontrado ou já excluído');
    if (this.transactionsByCenter[id]) {
      throw new ConflictError('Não é possível excluir o centro de custo pois existem lançamentos relacionados.');
    }
    center.deleted_at = new Date();
    return center;
  }
  async findDeletionState(id: string) {
    const center = this.items.find((x) => x.id === id);
    return center ? { id: center.id, deleted_at: center.deleted_at } : null;
  }
  async restore(id: string) {
    const center = this.items.find((x) => x.id === id)!;
    center.deleted_at = null;
    return center;
  }
  async quickCreate(data: { name: string; type: 'INCOME' | 'EXPENSE' }) {
    const norm = data.name.toLowerCase();
    const existing = this.items.find(
      (c) => c.name.toLowerCase() === norm && c.type === data.type && !c.deleted_at,
    );
    if (existing) return existing;
    return this.create({ name: data.name, type: data.type });
  }
}

function seed(repo: InMemoryCentersRepository, over: Partial<Center> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'center-1', name: 'Administrativo', type: 'EXPENSE', is_active: true, company_id: 'c-1',
    created_at: now, updated_at: now, deleted_at: null, ...over,
  } as Center & { deleted_at: Date | null });
}

describe('Center use-cases', () => {
  let repo: InMemoryCentersRepository;
  beforeEach(() => { repo = new InMemoryCentersRepository(); });

  describe('CreateCenterUseCase', () => {
    it('cria centro com defaults', async () => {
      const out = await new CreateCenterUseCase(repo).execute({ name: 'Administrativo', type: 'EXPENSE' });
      expect(out.name).toBe('Administrativo');
      expect(out.type).toBe('EXPENSE');
      expect(out.is_active).toBe(true);
    });
    it('rejeita nome vazio (400)', async () => {
      await expect(new CreateCenterUseCase(repo).execute({ name: '  ', type: 'EXPENSE' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita tipo inválido (400)', async () => {
      await expect(
        new CreateCenterUseCase(repo).execute({ name: 'X', type: 'OUTRO' as 'EXPENSE' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita ausência de tipo (400)', async () => {
      await expect(
        new CreateCenterUseCase(repo).execute({ name: 'X', type: undefined as unknown as 'EXPENSE' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('UpdateCenterUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateCenterUseCase(repo).execute('ghost', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita nome vazio no update (400)', async () => {
      seed(repo);
      await expect(new UpdateCenterUseCase(repo).execute('center-1', { name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita tipo inválido no update (400)', async () => {
      seed(repo);
      await expect(
        new UpdateCenterUseCase(repo).execute('center-1', { type: 'INVALID' as 'EXPENSE' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
    it('atualiza nome', async () => {
      seed(repo);
      const out = await new UpdateCenterUseCase(repo).execute('center-1', { name: 'Financeiro' });
      expect(out.name).toBe('Financeiro');
    });
  });

  describe('DeleteCenterUseCase', () => {
    it('lança NotFound se não existe ou já excluído', async () => {
      await expect(new DeleteCenterUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ConflictError se existirem lançamentos relacionados', async () => {
      seed(repo);
      repo.transactionsByCenter['center-1'] = 1;
      await expect(new DeleteCenterUseCase(repo).execute('center-1')).rejects.toBeInstanceOf(ConflictError);
    });
    it('faz soft-delete', async () => {
      seed(repo);
      await new DeleteCenterUseCase(repo).execute('center-1');
      expect(repo.items[0].deleted_at).not.toBeNull();
    });
  });

  describe('RestoreCenterUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new RestoreCenterUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestoreCenterUseCase(repo).execute('center-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura', async () => {
      seed(repo);
      repo.items[0].deleted_at = new Date();
      const out = await new RestoreCenterUseCase(repo).execute('center-1');
      expect(out.deleted_at).toBeNull();
    });
  });

  describe('GetCenterByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetCenterByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('retorna o centro', async () => {
      seed(repo);
      const out = await new GetCenterByIdUseCase(repo).execute('center-1');
      expect(out.name).toBe('Administrativo');
    });
    it('lança ValidationError sem ID', async () => {
      await expect(new GetCenterByIdUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('QuickCreateCenterUseCase', () => {
    it('lança ValidationError sem nome', async () => {
      await expect(new QuickCreateCenterUseCase(repo).execute({ name: '', type: 'EXPENSE' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança ValidationError sem tipo', async () => {
      await expect(
        new QuickCreateCenterUseCase(repo).execute({ name: 'X', type: undefined as unknown as 'EXPENSE' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
    it('retorna existente quando nome+tipo coincidem (insensível a caixa)', async () => {
      seed(repo);
      const out = await new QuickCreateCenterUseCase(repo).execute({ name: 'administrativo', type: 'EXPENSE' });
      expect(out.id).toBe('center-1');
    });
    it('cria novo quando não existe', async () => {
      const out = await new QuickCreateCenterUseCase(repo).execute({ name: 'TI', type: 'EXPENSE' });
      expect(out.name).toBe('TI');
      expect(out.is_active).toBe(true);
    });
  });

  describe('ListCentersUseCase / GetCenterFiltersUseCase', () => {
    it('lista', async () => {
      seed(repo);
      const out = await new ListCentersUseCase(repo).execute({ limit: 30, page: 1, filters: {}, sortOptions: {}, includeInactive: false });
      expect(out.count).toBe(1);
    });
    it('retorna filtros', async () => {
      const out = await new GetCenterFiltersUseCase(repo).execute();
      expect(out).toEqual({ filters: [] });
    });
  });
});