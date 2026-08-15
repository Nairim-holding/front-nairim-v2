import { describe, it, expect, beforeEach } from 'vitest';
import type { AgenciesRepository } from '@/core/repositories/agencies-repository';
import type {
  Agency, ContactSuggestion, CreateAgencyData, ListAgenciesParams, PaginatedAgencies, UpdateAgencyData,
} from '@/core/entities/agency';
import {
  CreateAgencyUseCase, UpdateAgencyUseCase, DeleteAgencyUseCase, RestoreAgencyUseCase, GetAgencyByIdUseCase,
} from '@/core/use-cases/agency/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/** Repositório de imobiliárias em memória. */
class InMemoryAgenciesRepository implements AgenciesRepository {
  items: (Agency & { deleted_at: Date | null })[] = [];

  async list(params: ListAgenciesParams): Promise<PaginatedAgencies> {
    const active = this.items.filter((a) => params.includeInactive || !a.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters(): Promise<Record<string, unknown>> {
    return { filters: [], operators: {}, defaultSort: 'created_at:desc', searchFields: [] };
  }
  async findById(id: string): Promise<Agency | null> {
    return this.items.find((a) => a.id === id && !a.deleted_at) ?? null;
  }
  async cnpjExists(cnpj: string): Promise<boolean> {
    return this.items.some((a) => a.cnpj === cnpj && !a.deleted_at);
  }
  async cnpjExistsExcept(cnpj: string, exceptId: string): Promise<boolean> {
    return this.items.some((a) => a.cnpj === cnpj && !a.deleted_at && a.id !== exceptId);
  }
  async create(data: CreateAgencyData): Promise<Agency> {
    const now = new Date();
    const agency = { id: `a-${this.items.length + 1}`, ...data, created_at: now, updated_at: now, deleted_at: null } as unknown as Agency & { deleted_at: Date | null };
    this.items.push(agency);
    return agency;
  }
  async update(id: string, data: UpdateAgencyData): Promise<Agency> {
    const a = this.items.find((x) => x.id === id)!;
    Object.assign(a, data);
    return a;
  }
  async softDelete(id: string): Promise<{ legal_name: string }> {
    const a = this.items.find((x) => x.id === id)!;
    a.deleted_at = new Date();
    return { legal_name: a.legal_name };
  }
  async findDeletionState(id: string) {
    const a = this.items.find((x) => x.id === id);
    return a ? { legal_name: a.legal_name, deleted_at: a.deleted_at } : null;
  }
  async restore(id: string): Promise<{ legal_name: string }> {
    const a = this.items.find((x) => x.id === id)!;
    a.deleted_at = null;
    return { legal_name: a.legal_name };
  }
  async getAvailableContacts(): Promise<ContactSuggestion[]> {
    return [];
  }
}

function seed(repo: InMemoryAgenciesRepository, over: Partial<Agency> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'a-1', trade_name: 'Imob X', legal_name: 'Imob X LTDA', cnpj: '11222333000181',
    created_at: now, updated_at: now, deleted_at: null, ...over,
  } as Agency & { deleted_at: Date | null });
}

const base: CreateAgencyData = { trade_name: 'Nova', legal_name: 'Nova LTDA', cnpj: '99888777000166' };

describe('Agency use-cases', () => {
  let repo: InMemoryAgenciesRepository;
  beforeEach(() => { repo = new InMemoryAgenciesRepository(); });

  describe('CreateAgencyUseCase', () => {
    it('cria imobiliária', async () => {
      const out = await new CreateAgencyUseCase(repo).execute(base);
      expect(out.legal_name).toBe('Nova LTDA');
    });
    it('rejeita CNPJ já cadastrado (409)', async () => {
      seed(repo, { cnpj: '99888777000166' });
      await expect(new CreateAgencyUseCase(repo).execute(base)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('UpdateAgencyUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateAgencyUseCase(repo).execute('ghost', { trade_name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita CNPJ usado por outra (409)', async () => {
      seed(repo, { id: 'a-1', cnpj: '11111111111111' });
      seed(repo, { id: 'a-2', cnpj: '22222222222222' });
      await expect(new UpdateAgencyUseCase(repo).execute('a-2', { cnpj: '11111111111111' })).rejects.toBeInstanceOf(ConflictError);
    });
    it('permite manter o mesmo CNPJ', async () => {
      seed(repo, { id: 'a-1', cnpj: '11111111111111' });
      const out = await new UpdateAgencyUseCase(repo).execute('a-1', { cnpj: '11111111111111', trade_name: 'Novo Nome' });
      expect(out.trade_name).toBe('Novo Nome');
    });
  });

  describe('DeleteAgencyUseCase', () => {
    it('faz soft-delete', async () => {
      seed(repo);
      const out = await new DeleteAgencyUseCase(repo).execute('a-1');
      expect(out.legal_name).toBe('Imob X LTDA');
      expect(repo.items[0].deleted_at).not.toBeNull();
    });
    it('lança NotFound se não existe', async () => {
      await expect(new DeleteAgencyUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('RestoreAgencyUseCase', () => {
    it('restaura excluída', async () => {
      seed(repo, { deleted_at: new Date() });
      const out = await new RestoreAgencyUseCase(repo).execute('a-1');
      expect(out.legal_name).toBe('Imob X LTDA');
      expect(repo.items[0].deleted_at).toBeNull();
    });
    it('lança ValidationError se não está excluída', async () => {
      seed(repo);
      await expect(new RestoreAgencyUseCase(repo).execute('a-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança NotFound se não existe', async () => {
      await expect(new RestoreAgencyUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('GetAgencyByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetAgencyByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('exige ID', async () => {
      await expect(new GetAgencyByIdUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
