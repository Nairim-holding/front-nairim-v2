import { describe, it, expect, beforeEach } from 'vitest';
import type { SuppliersRepository } from '@/core/repositories/financial-suppliers-repository';
import type {
  CreateSupplierData,
  ListSuppliersParams,
  PaginatedSuppliers,
  Supplier,
  UpdateSupplierData,
} from '@/core/entities/financial-supplier';
import {
  CreateSupplierUseCase,
  DeleteSupplierUseCase,
  GetSupplierByIdUseCase,
  GetSupplierFiltersUseCase,
  ListSuppliersUseCase,
  QuickCreateSupplierUseCase,
  RestoreSupplierUseCase,
  UpdateSupplierUseCase,
} from '@/core/use-cases/financial-supplier/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemorySuppliersRepository implements SuppliersRepository {
  items: (Supplier & { deleted_at: Date | null })[] = [];

  async list(params: ListSuppliersParams): Promise<PaginatedSuppliers> {
    const active = this.items.filter((s) => params.includeInactive || !s.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters() { return { filters: [] }; }
  async findById(id: string) {
    return this.items.find((s) => s.id === id && !s.deleted_at) ?? null;
  }
  async create(data: CreateSupplierData) {
    if (data.cnpj && this.items.some((s) => s.cnpj === data.cnpj && !s.deleted_at)) {
      throw new ConflictError('Este CNPJ já está cadastrado');
    }
    if (data.cpf && this.items.some((s) => s.cpf === data.cpf && !s.deleted_at)) {
      throw new ConflictError('Este CPF já está cadastrado');
    }
    const now = new Date();
    const supplier = {
      id: `supplier-${this.items.length + 1}`, company_id: 'c-1', sequential_id: this.items.length + 1,
      legal_name: data.legal_name, trade_name: data.trade_name ?? null, cnpj: data.cnpj ?? null, cpf: data.cpf ?? null,
      state_registration: data.state_registration ?? null, municipal_registration: data.municipal_registration ?? null,
      internal_code: data.internal_code ?? null, created_via: 'full_form', is_active: true,
      marital_status: data.marital_status ?? null, occupation: data.occupation ?? null,
      created_at: now, updated_at: now, deleted_at: null,
    } as Supplier & { deleted_at: Date | null };
    this.items.push(supplier);
    return supplier;
  }
  async update(id: string, data: UpdateSupplierData) {
    const supplier = this.items.find((x) => x.id === id);
    if (!supplier) throw new NotFoundError('Fornecedor não encontrado');
    if (data.cnpj && this.items.some((s) => s.cnpj === data.cnpj && s.id !== id && !s.deleted_at)) {
      throw new ConflictError('Este CNPJ já está cadastrado para outro fornecedor');
    }
    if (data.cpf && this.items.some((s) => s.cpf === data.cpf && s.id !== id && !s.deleted_at)) {
      throw new ConflictError('Este CPF já está cadastrado para outro fornecedor');
    }
    Object.assign(supplier, data);
    return supplier;
  }
  async softDelete(id: string) {
    const supplier = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!supplier) throw new NotFoundError('Fornecedor não encontrado ou já excluído');
    supplier.deleted_at = new Date();
    return supplier;
  }
  async findDeletionState(id: string) {
    const supplier = this.items.find((x) => x.id === id);
    return supplier ? { id: supplier.id, deleted_at: supplier.deleted_at } : null;
  }
  async restore(id: string) {
    const supplier = this.items.find((x) => x.id === id)!;
    supplier.deleted_at = null;
    return supplier;
  }
  async quickCreate(data: { legal_name: string }) {
    const norm = data.legal_name.toLowerCase();
    const existing = this.items.find((s) => s.legal_name.toLowerCase() === norm && !s.deleted_at);
    if (existing) return existing;
    return this.create({ legal_name: data.legal_name, internal_code: String(this.items.length + 1) });
  }
}

function seed(repo: InMemorySuppliersRepository, over: Partial<Supplier> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'supplier-1', company_id: 'c-1', sequential_id: 1, legal_name: 'Fornecedor Teste',
    trade_name: null, cnpj: '11222333000181', cpf: null, state_registration: null,
    municipal_registration: null, internal_code: '1', created_via: 'full_form', is_active: true,
    marital_status: null, occupation: null, created_at: now, updated_at: now, deleted_at: null, ...over,
  } as Supplier & { deleted_at: Date | null });
}

describe('Supplier use-cases', () => {
  let repo: InMemorySuppliersRepository;
  beforeEach(() => { repo = new InMemorySuppliersRepository(); });

  describe('CreateSupplierUseCase', () => {
    it('cria fornecedor', async () => {
      const out = await new CreateSupplierUseCase(repo).execute({ legal_name: 'Outra Empresa Ltda' });
      expect(out.legal_name).toBe('Outra Empresa Ltda');
      expect(out.is_active).toBe(true);
    });
    it('rejeita nome vazio (400)', async () => {
      await expect(new CreateSupplierUseCase(repo).execute({ legal_name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita CNPJ com menos de 14 dígitos (400)', async () => {
      await expect(new CreateSupplierUseCase(repo).execute({ legal_name: 'X', cnpj: '123' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita CPF com menos de 11 dígitos (400)', async () => {
      await expect(new CreateSupplierUseCase(repo).execute({ legal_name: 'X', cpf: '123' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança ConflictError quando CNPJ já cadastrado (409)', async () => {
      seed(repo);
      await expect(
        new CreateSupplierUseCase(repo).execute({ legal_name: 'Outra', cnpj: '11222333000181' }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('UpdateSupplierUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateSupplierUseCase(repo).execute('ghost', { legal_name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita nome vazio no update (400)', async () => {
      seed(repo);
      await expect(new UpdateSupplierUseCase(repo).execute('supplier-1', { legal_name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança ConflictError quando o CNPJ pertence a outro (409)', async () => {
      seed(repo, { id: 'supplier-1', cnpj: '11111111111111' });
      seed(repo, { id: 'supplier-2', legal_name: 'Outro', cnpj: '11222333000181', internal_code: '2' });
      await expect(
        new UpdateSupplierUseCase(repo).execute('supplier-1', { cnpj: '11222333000181' }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
    it('atualiza legal_name', async () => {
      seed(repo);
      const out = await new UpdateSupplierUseCase(repo).execute('supplier-1', { legal_name: 'Novo Nome' });
      expect(out.legal_name).toBe('Novo Nome');
    });
  });

  describe('DeleteSupplierUseCase', () => {
    it('lança NotFound se não existe ou já excluído', async () => {
      await expect(new DeleteSupplierUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('faz soft-delete', async () => {
      seed(repo);
      await new DeleteSupplierUseCase(repo).execute('supplier-1');
      expect(repo.items[0].deleted_at).not.toBeNull();
    });
  });

  describe('RestoreSupplierUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new RestoreSupplierUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestoreSupplierUseCase(repo).execute('supplier-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura', async () => {
      seed(repo);
      repo.items[0].deleted_at = new Date();
      const out = await new RestoreSupplierUseCase(repo).execute('supplier-1');
      expect(out.deleted_at).toBeNull();
    });
  });

  describe('GetSupplierByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetSupplierByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('retorna o fornecedor', async () => {
      seed(repo);
      const out = await new GetSupplierByIdUseCase(repo).execute('supplier-1');
      expect(out.legal_name).toBe('Fornecedor Teste');
    });
  });

  describe('QuickCreateSupplierUseCase', () => {
    it('lança ValidationError quando legal_name < 2 chars', async () => {
      await expect(new QuickCreateSupplierUseCase(repo).execute({ legal_name: 'A' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança ValidationError quando legal_name > 150 chars', async () => {
      await expect(
        new QuickCreateSupplierUseCase(repo).execute({ legal_name: 'X'.repeat(151) }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
    it('retorna existente quando legal_name coincide (insensível a caixa)', async () => {
      seed(repo);
      const out = await new QuickCreateSupplierUseCase(repo).execute({ legal_name: 'fornecedor teste' });
      expect(out.id).toBe('supplier-1');
    });
    it('cria novo quando não existe', async () => {
      const out = await new QuickCreateSupplierUseCase(repo).execute({ legal_name: 'Novo' });
      expect(out.legal_name).toBe('Novo');
    });
  });

  describe('ListSuppliersUseCase / GetSupplierFiltersUseCase', () => {
    it('lista', async () => {
      seed(repo);
      const out = await new ListSuppliersUseCase(repo).execute({ limit: 30, page: 1, filters: {}, sortOptions: {}, includeInactive: false });
      expect(out.count).toBe(1);
    });
    it('retorna filtros', async () => {
      const out = await new GetSupplierFiltersUseCase(repo).execute();
      expect(out).toEqual({ filters: [] });
    });
  });
});