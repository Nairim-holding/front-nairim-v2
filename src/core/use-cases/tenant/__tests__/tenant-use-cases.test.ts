import { describe, it, expect, beforeEach } from 'vitest';
import type { TenantsRepository } from '@/core/repositories/tenants-repository';
import type { ContactSuggestion } from '@/core/entities/agency';
import type { CreateTenantData, ListTenantsParams, PaginatedTenants, Tenant, UpdateTenantData } from '@/core/entities/tenant';
import {
  CreateTenantUseCase, UpdateTenantUseCase, DeleteTenantUseCase, RestoreTenantUseCase, GetTenantByIdUseCase,
} from '@/core/use-cases/tenant/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemoryTenantsRepository implements TenantsRepository {
  items: (Tenant & { deleted_at: Date | null })[] = [];

  async list(params: ListTenantsParams): Promise<PaginatedTenants> {
    const active = this.items.filter((t) => params.includeInactive || !t.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters(): Promise<Record<string, unknown>> { return { filters: [] }; }
  async findById(id: string): Promise<Tenant | null> {
    return this.items.find((t) => t.id === id && !t.deleted_at) ?? null;
  }
  async internalCodeExists(code: string) { return this.items.some((t) => t.internal_code === code && !t.deleted_at); }
  async internalCodeExistsExcept(code: string, exceptId: string) { return this.items.some((t) => t.internal_code === code && !t.deleted_at && t.id !== exceptId); }
  async cpfExists(cpf: string) { return this.items.some((t) => t.cpf === cpf && !t.deleted_at); }
  async cpfExistsExcept(cpf: string, exceptId: string) { return this.items.some((t) => t.cpf === cpf && !t.deleted_at && t.id !== exceptId); }
  async cnpjExists(cnpj: string) { return this.items.some((t) => t.cnpj === cnpj && !t.deleted_at); }
  async cnpjExistsExcept(cnpj: string, exceptId: string) { return this.items.some((t) => t.cnpj === cnpj && !t.deleted_at && t.id !== exceptId); }
  async create(data: CreateTenantData): Promise<Tenant> {
    const now = new Date();
    // Fiel ao backend: grava tudo como recebido, sem nulling.
    const tenant = { id: `t-${this.items.length + 1}`, ...data, created_at: now, updated_at: now, deleted_at: null } as unknown as Tenant & { deleted_at: Date | null };
    this.items.push(tenant);
    return tenant;
  }
  async update(id: string, data: UpdateTenantData): Promise<Tenant> {
    const t = this.items.find((x) => x.id === id)!;
    Object.assign(t, data);
    return t;
  }
  async softDelete(id: string): Promise<{ name: string }> {
    const t = this.items.find((x) => x.id === id);
    if (!t) throw new Error('Simulated P2025 (record not found)');
    t.deleted_at = new Date();
    return { name: t.name };
  }
  async findDeletionState(id: string) {
    const t = this.items.find((x) => x.id === id);
    return t ? { name: t.name, deleted_at: t.deleted_at } : null;
  }
  async restore(id: string): Promise<Tenant> {
    const t = this.items.find((x) => x.id === id)!;
    t.deleted_at = null;
    return t;
  }
  async getAvailableContacts(): Promise<ContactSuggestion[]> { return []; }
  async getNextInternalCode(): Promise<string> {
    // Espelha o backend: MAX numérico + 1; não numéricos ignorados; vazio → "1".
    const max = this.items.reduce((acc, t) => {
      const code = String(t.internal_code ?? '').trim();
      if (!/^\d+$/.test(code)) return acc;
      const n = parseInt(code, 10);
      return n > acc ? n : acc;
    }, 0);
    return String(max + 1);
  }
}

function seed(repo: InMemoryTenantsRepository, over: Partial<Tenant> = {}) {
  const now = new Date();
  repo.items.push({
    id: 't-1', name: 'Ana', internal_code: '001', cpf: '52998224725',
    created_at: now, updated_at: now, deleted_at: null, ...over,
  } as Tenant & { deleted_at: Date | null });
}

const pf: CreateTenantData = { name: 'Novo', internal_code: '002', cpf: '52998224725', occupation: 'Advogado', marital_status: 'Casado' };

describe('Tenant use-cases', () => {
  let repo: InMemoryTenantsRepository;
  beforeEach(() => { repo = new InMemoryTenantsRepository(); });

  describe('CreateTenantUseCase', () => {
    it('cria sem aplicar nulling PF/PJ (fiel ao backend)', async () => {
      const data: CreateTenantData = { ...pf, cnpj: '11222333000181' };
      const out = await new CreateTenantUseCase(repo).execute(data);
      // Diferente do Owner: cpf E cnpj podem coexistir.
      expect(out.cpf).toBe('52998224725');
      expect(out.cnpj).toBe('11222333000181');
    });
    it('rejeita internal_code duplicado (409)', async () => {
      seed(repo, { internal_code: '002' });
      await expect(new CreateTenantUseCase(repo).execute(pf)).rejects.toBeInstanceOf(ConflictError);
    });
    it('rejeita CPF duplicado (409)', async () => {
      seed(repo, { cpf: '52998224725', internal_code: 'x' });
      await expect(new CreateTenantUseCase(repo).execute(pf)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('UpdateTenantUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateTenantUseCase(repo).execute('ghost', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita CNPJ usado por outro (409)', async () => {
      seed(repo, { id: 't-1', cnpj: '11222333000181', cpf: null });
      seed(repo, { id: 't-2', internal_code: '002', cpf: '11144477735' });
      await expect(new UpdateTenantUseCase(repo).execute('t-2', { cnpj: '11222333000181' })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('DeleteTenantUseCase', () => {
    it('NÃO verifica existência antes (propaga erro do repositório)', async () => {
      await expect(new DeleteTenantUseCase(repo).execute('ghost')).rejects.toThrow();
    });
    it('faz soft-delete quando existe', async () => {
      seed(repo);
      const out = await new DeleteTenantUseCase(repo).execute('t-1');
      expect(out.name).toBe('Ana');
    });
  });

  describe('RestoreTenantUseCase', () => {
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestoreTenantUseCase(repo).execute('t-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura excluído', async () => {
      seed(repo, { deleted_at: new Date() });
      const out = await new RestoreTenantUseCase(repo).execute('t-1');
      expect(out.id).toBe('t-1');
    });
  });

  describe('GetTenantByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetTenantByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
