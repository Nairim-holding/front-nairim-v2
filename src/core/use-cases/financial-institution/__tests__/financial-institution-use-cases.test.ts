import { describe, it, expect, beforeEach } from 'vitest';
import type { FinancialInstitutionsRepository } from '@/core/repositories/financial-institutions-repository';
import type {
  BalanceSummaryItem,
  CreateFinancialInstitutionData,
  FinancialInstitution,
  ListFinancialInstitutionsParams,
  UpdateFinancialInstitutionData,
} from '@/core/entities/financial-institution';
import {
  CreateFinancialInstitutionUseCase,
  UpdateFinancialInstitutionUseCase,
  DeleteFinancialInstitutionUseCase,
  RestoreFinancialInstitutionUseCase,
  GetFinancialInstitutionByIdUseCase,
  QuickCreateFinancialInstitutionUseCase,
} from '@/core/use-cases/financial-institution/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemoryFinancialInstitutionsRepository implements FinancialInstitutionsRepository {
  items: (FinancialInstitution & { deleted_at: Date | null })[] = [];
  transactionsByInstitution: Record<string, number> = {};

  async list(params: ListFinancialInstitutionsParams) {
    const active = this.items.filter((i) => params.includeInactive || !i.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters() { return { filters: [] }; }
  async findById(id: string) {
    return this.items.find((i) => i.id === id && !i.deleted_at) ?? null;
  }
  async create(data: CreateFinancialInstitutionData) {
    const now = new Date();
    const inst = {
      id: `inst-${this.items.length + 1}`, name: data.name,
      bank_number: data.bank_number ?? null, agency_number: data.agency_number ?? null,
      account_number: data.account_number ?? null,
      is_active: data.is_active ?? true,
      company_id: 'c-1', created_at: now, updated_at: now, deleted_at: null,
    } as FinancialInstitution & { deleted_at: Date | null };
    this.items.push(inst);
    return inst;
  }
  async update(id: string, data: UpdateFinancialInstitutionData) {
    const inst = this.items.find((x) => x.id === id)!;
    Object.assign(inst, data);
    return inst;
  }
  async softDelete(id: string) {
    const inst = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!inst) throw new NotFoundError('Instituição não encontrada ou já excluída');
    if (this.transactionsByInstitution[id]) {
      throw new ConflictError('Não é possível excluir a instituição financeira pois existem lançamentos relacionados.');
    }
    inst.deleted_at = new Date();
    return inst;
  }
  async findDeletionState(id: string) {
    const inst = this.items.find((x) => x.id === id);
    return inst ? { deleted_at: inst.deleted_at } : null;
  }
  async restore(id: string) {
    const inst = this.items.find((x) => x.id === id)!;
    inst.deleted_at = null;
    return inst;
  }
  async quickCreate(data: { name: string }) {
    const norm = data.name.toLowerCase();
    const existing = this.items.find((i) => i.name.toLowerCase() === norm && !i.deleted_at);
    if (existing) return existing;
    return this.create({ name: data.name });
  }
  async getBalanceSummary(): Promise<BalanceSummaryItem[]> { return []; }
}

function seed(repo: InMemoryFinancialInstitutionsRepository, over: Partial<FinancialInstitution> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'inst-1', name: 'Banco do Brasil', bank_number: '001', agency_number: null,
    account_number: null, is_active: true, company_id: 'c-1', created_at: now, updated_at: now,
    deleted_at: null, ...over,
  } as FinancialInstitution & { deleted_at: Date | null });
}

const base: CreateFinancialInstitutionData = { name: 'Itaú', bank_number: '341', agency_number: '0102', account_number: '12345-6' };

describe('FinancialInstitution use-cases', () => {
  let repo: InMemoryFinancialInstitutionsRepository;
  beforeEach(() => { repo = new InMemoryFinancialInstitutionsRepository(); });

  describe('CreateFinancialInstitutionUseCase', () => {
    it('cria instituição', async () => {
      const out = await new CreateFinancialInstitutionUseCase(repo).execute(base);
      expect(out.name).toBe('Itaú');
      expect(out.is_active).toBe(true);
    });
    it('rejeita nome vazio (400)', async () => {
      await expect(new CreateFinancialInstitutionUseCase(repo).execute({ name: '   ' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('UpdateFinancialInstitutionUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateFinancialInstitutionUseCase(repo).execute('ghost', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita nome vazio no update (400)', async () => {
      seed(repo);
      await expect(new UpdateFinancialInstitutionUseCase(repo).execute('inst-1', { name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('atualiza campos', async () => {
      seed(repo);
      const out = await new UpdateFinancialInstitutionUseCase(repo).execute('inst-1', { bank_number: '999', is_active: false });
      expect(out.bank_number).toBe('999');
      expect(out.is_active).toBe(false);
    });
  });

  describe('DeleteFinancialInstitutionUseCase', () => {
    it('lança NotFound se não existe ou já excluído', async () => {
      await expect(new DeleteFinancialInstitutionUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança Conflict se existirem lançamentos relacionados', async () => {
      seed(repo);
      repo.transactionsByInstitution['inst-1'] = 1;
      await expect(new DeleteFinancialInstitutionUseCase(repo).execute('inst-1')).rejects.toBeInstanceOf(ConflictError);
    });
    it('faz soft-delete', async () => {
      seed(repo);
      await new DeleteFinancialInstitutionUseCase(repo).execute('inst-1');
      expect(repo.items[0].deleted_at).not.toBeNull();
    });
  });

  describe('RestoreFinancialInstitutionUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new RestoreFinancialInstitutionUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestoreFinancialInstitutionUseCase(repo).execute('inst-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura', async () => {
      seed(repo);
      repo.items[0].deleted_at = new Date();
      const out = await new RestoreFinancialInstitutionUseCase(repo).execute('inst-1');
      expect(out.deleted_at).toBeNull();
    });
  });

  describe('GetFinancialInstitutionByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetFinancialInstitutionByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('retorna a instituição', async () => {
      seed(repo);
      const out = await new GetFinancialInstitutionByIdUseCase(repo).execute('inst-1');
      expect(out.name).toBe('Banco do Brasil');
    });
  });

  describe('QuickCreateFinancialInstitutionUseCase', () => {
    it('lança ValidationError sem nome', async () => {
      await expect(new QuickCreateFinancialInstitutionUseCase(repo).execute({ name: '' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('retorna existente quando o nome coincide (insensível a caixa)', async () => {
      seed(repo);
      const out = await new QuickCreateFinancialInstitutionUseCase(repo).execute({ name: 'banco do brasil' });
      expect(out.id).toBe('inst-1');
    });
    it('cria nova quando não existe', async () => {
      const out = await new QuickCreateFinancialInstitutionUseCase(repo).execute({ name: 'Novo Banco' });
      expect(out.name).toBe('Novo Banco');
      expect(out.is_active).toBe(true);
    });
  });
});