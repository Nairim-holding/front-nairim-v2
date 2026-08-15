import { describe, it, expect, beforeEach } from 'vitest';
import type { OwnersRepository } from '@/core/repositories/owners-repository';
import type { ContactSuggestion } from '@/core/entities/agency';
import type { CreateOwnerData, ListOwnersParams, Owner, PaginatedOwners, UpdateOwnerData } from '@/core/entities/owner';
import {
  CreateOwnerUseCase, UpdateOwnerUseCase, DeleteOwnerUseCase, RestoreOwnerUseCase, GetOwnerByIdUseCase,
} from '@/core/use-cases/owner/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemoryOwnersRepository implements OwnersRepository {
  items: (Owner & { deleted_at: Date | null })[] = [];

  async list(params: ListOwnersParams): Promise<PaginatedOwners> {
    const active = this.items.filter((o) => params.includeInactive || !o.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters(): Promise<Record<string, unknown>> { return { filters: [] }; }
  async findById(id: string): Promise<Owner | null> {
    return this.items.find((o) => o.id === id && !o.deleted_at) ?? null;
  }
  async internalCodeExists(code: string) { return this.items.some((o) => o.internal_code === code && !o.deleted_at); }
  async internalCodeExistsExcept(code: string, exceptId: string) { return this.items.some((o) => o.internal_code === code && !o.deleted_at && o.id !== exceptId); }
  async cpfExists(cpf: string) { return this.items.some((o) => o.cpf === cpf && !o.deleted_at); }
  async cpfExistsExcept(cpf: string, exceptId: string) { return this.items.some((o) => o.cpf === cpf && !o.deleted_at && o.id !== exceptId); }
  async cnpjExists(cnpj: string) { return this.items.some((o) => o.cnpj === cnpj && !o.deleted_at); }
  async cnpjExistsExcept(cnpj: string, exceptId: string) { return this.items.some((o) => o.cnpj === cnpj && !o.deleted_at && o.id !== exceptId); }
  async create(data: CreateOwnerData): Promise<Owner> {
    const now = new Date();
    const owner = { id: `o-${this.items.length + 1}`, ...data, created_at: now, updated_at: now, deleted_at: null } as unknown as Owner & { deleted_at: Date | null };
    this.items.push(owner);
    return owner;
  }
  async update(id: string, data: UpdateOwnerData): Promise<Owner> {
    const o = this.items.find((x) => x.id === id)!;
    Object.assign(o, data);
    return o;
  }
  async softDelete(id: string): Promise<{ name: string } | null> {
    const o = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!o) return null;
    o.deleted_at = new Date();
    return { name: o.name };
  }
  async findDeletionState(id: string) {
    const o = this.items.find((x) => x.id === id);
    return o ? { name: o.name, deleted_at: o.deleted_at } : null;
  }
  async restore(id: string): Promise<Owner> {
    const o = this.items.find((x) => x.id === id)!;
    o.deleted_at = null;
    return o;
  }
  async getAvailableContacts(): Promise<ContactSuggestion[]> { return []; }
}

function seed(repo: InMemoryOwnersRepository, over: Partial<Owner> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'o-1', name: 'Carlos', internal_code: '001', cpf: '52998224725',
    created_at: now, updated_at: now, deleted_at: null, ...over,
  } as Owner & { deleted_at: Date | null });
}

const pf: CreateOwnerData = { name: 'Novo', internal_code: '002', cpf: '52998224725', occupation: 'Engenheiro', marital_status: 'Solteiro' };
const pj: CreateOwnerData = { name: 'Empresa', internal_code: '003', cnpj: '11222333000181' };

describe('Owner use-cases', () => {
  let repo: InMemoryOwnersRepository;
  beforeEach(() => { repo = new InMemoryOwnersRepository(); });

  describe('CreateOwnerUseCase', () => {
    it('cria PF zerando campos de PJ', async () => {
      const out = await new CreateOwnerUseCase(repo).execute(pf);
      expect(out.cpf).toBe('52998224725');
      expect(out.cnpj).toBeNull();
      expect(out.state_registration).toBeNull();
    });
    it('cria PJ zerando campos de PF', async () => {
      const out = await new CreateOwnerUseCase(repo).execute(pj);
      expect(out.cnpj).toBe('11222333000181');
      expect(out.cpf).toBeNull();
      expect(out.occupation).toBeNull();
    });
    it('rejeita internal_code duplicado (409)', async () => {
      seed(repo, { internal_code: '002' });
      await expect(new CreateOwnerUseCase(repo).execute(pf)).rejects.toBeInstanceOf(ConflictError);
    });
    it('rejeita CPF duplicado (409)', async () => {
      seed(repo, { cpf: '52998224725', internal_code: 'x' });
      await expect(new CreateOwnerUseCase(repo).execute(pf)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('UpdateOwnerUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateOwnerUseCase(repo).execute('ghost', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita CPF usado por outro (409)', async () => {
      seed(repo, { id: 'o-1', cpf: '52998224725' });
      seed(repo, { id: 'o-2', cpf: '11144477735', internal_code: '002' });
      await expect(new UpdateOwnerUseCase(repo).execute('o-2', { cpf: '52998224725' })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('DeleteOwnerUseCase', () => {
    it('lança NotFound se não existe ou já excluído', async () => {
      await expect(new DeleteOwnerUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('faz soft-delete', async () => {
      seed(repo);
      const out = await new DeleteOwnerUseCase(repo).execute('o-1');
      expect(out.name).toBe('Carlos');
    });
  });

  describe('RestoreOwnerUseCase', () => {
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestoreOwnerUseCase(repo).execute('o-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura excluído', async () => {
      seed(repo, { deleted_at: new Date() });
      const out = await new RestoreOwnerUseCase(repo).execute('o-1');
      expect(out.id).toBe('o-1');
    });
  });

  describe('GetOwnerByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetOwnerByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
