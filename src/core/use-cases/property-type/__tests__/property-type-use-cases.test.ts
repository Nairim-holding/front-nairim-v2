import { describe, it, expect, beforeEach } from 'vitest';
import type { PropertyTypesRepository } from '@/core/repositories/property-types-repository';
import type { CreatePropertyTypeData, ListPropertyTypesParams, PaginatedPropertyTypes, PropertyType, UpdatePropertyTypeData } from '@/core/entities/property-type';
import {
  CreatePropertyTypeUseCase, UpdatePropertyTypeUseCase, DeletePropertyTypeUseCase, RestorePropertyTypeUseCase, GetPropertyTypeByIdUseCase,
} from '@/core/use-cases/property-type/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemoryPropertyTypesRepository implements PropertyTypesRepository {
  items: (PropertyType & { deleted_at: Date | null })[] = [];

  async list(params: ListPropertyTypesParams): Promise<PaginatedPropertyTypes> {
    const active = this.items.filter((t) => params.includeInactive || !t.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters(): Promise<Record<string, unknown>> { return { filters: [] }; }
  async findById(id: string): Promise<PropertyType | null> {
    return this.items.find((t) => t.id === id && !t.deleted_at) ?? null;
  }
  async descriptionExists(description: string) { return this.items.some((t) => t.description === description && !t.deleted_at); }
  async descriptionExistsExcept(description: string, exceptId: string) { return this.items.some((t) => t.description === description && !t.deleted_at && t.id !== exceptId); }
  async create(data: CreatePropertyTypeData): Promise<PropertyType> {
    const now = new Date();
    const type = { id: `pt-${this.items.length + 1}`, ...data, created_at: now, updated_at: now, deleted_at: null };
    this.items.push(type);
    return type;
  }
  async update(id: string, data: UpdatePropertyTypeData): Promise<PropertyType> {
    const t = this.items.find((x) => x.id === id)!;
    Object.assign(t, data);
    return t;
  }
  async softDelete(id: string): Promise<PropertyType | null> {
    const t = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!t) return null;
    t.deleted_at = new Date();
    return t;
  }
  async findDeletionState(id: string) {
    const t = this.items.find((x) => x.id === id);
    return t ? { description: t.description, deleted_at: t.deleted_at } : null;
  }
  async restore(id: string): Promise<PropertyType> {
    const t = this.items.find((x) => x.id === id)!;
    t.deleted_at = null;
    return t;
  }
}

function seed(repo: InMemoryPropertyTypesRepository, over: Partial<PropertyType> = {}) {
  const now = new Date();
  repo.items.push({ id: 'pt-1', description: 'Apartamento', created_at: now, updated_at: now, deleted_at: null, ...over });
}

describe('PropertyType use-cases', () => {
  let repo: InMemoryPropertyTypesRepository;
  beforeEach(() => { repo = new InMemoryPropertyTypesRepository(); });

  describe('CreatePropertyTypeUseCase', () => {
    it('cria tipo de imóvel', async () => {
      const out = await new CreatePropertyTypeUseCase(repo).execute({ description: 'Casa' });
      expect(out.description).toBe('Casa');
    });
    it('rejeita description duplicada (409)', async () => {
      seed(repo, { description: 'Casa' });
      await expect(new CreatePropertyTypeUseCase(repo).execute({ description: 'Casa' })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('UpdatePropertyTypeUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdatePropertyTypeUseCase(repo).execute('ghost', { description: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita description já usada por outro (409)', async () => {
      seed(repo, { id: 'pt-1', description: 'Casa' });
      seed(repo, { id: 'pt-2', description: 'Terreno' });
      await expect(new UpdatePropertyTypeUseCase(repo).execute('pt-2', { description: 'Casa' })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('DeletePropertyTypeUseCase', () => {
    it('lança NotFound se não existe/já excluído', async () => {
      await expect(new DeletePropertyTypeUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('faz soft-delete', async () => {
      seed(repo);
      const out = await new DeletePropertyTypeUseCase(repo).execute('pt-1');
      expect(out.description).toBe('Apartamento');
    });
  });

  describe('RestorePropertyTypeUseCase', () => {
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestorePropertyTypeUseCase(repo).execute('pt-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura excluído', async () => {
      seed(repo, { deleted_at: new Date() });
      const out = await new RestorePropertyTypeUseCase(repo).execute('pt-1');
      expect(out.id).toBe('pt-1');
    });
  });

  describe('GetPropertyTypeByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetPropertyTypeByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
