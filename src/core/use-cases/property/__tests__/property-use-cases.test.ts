import { describe, it, expect, beforeEach } from 'vitest';
import type { PropertiesRepository } from '@/core/repositories/properties-repository';
import type { Storage, UploadInput, UploadMediaResult } from '@/core/storage/storage';
import type {
  CreateUnifiedPropertyData, ListPropertiesParams, PaginatedProperties, Property, UpdateUnifiedPropertyData,
} from '@/core/entities/property';
import { CreateUnifiedPropertyUseCase } from '@/core/use-cases/property/create-unified';
import { UpdateUnifiedPropertyUseCase } from '@/core/use-cases/property/update-unified';
import { DeletePropertyUseCase, RestorePropertyUseCase } from '@/core/use-cases/property/crud';
import { GetPropertyByIdUseCase } from '@/core/use-cases/property/read';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemoryPropertiesRepository implements PropertiesRepository {
  items: (Property & { deleted_at: Date | null })[] = [];
  owners = new Set(['owner-1']);
  types = new Set(['type-1']);
  agencies = new Set(['agency-1']);
  documents: Array<{ propertyId: string; url: string; description: string; isFeatured: boolean; type: string }> = [];

  async list(params: ListPropertiesParams): Promise<PaginatedProperties> {
    const active = this.items.filter((p) => params.includeInactive || !p.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters(): Promise<Record<string, unknown>> { return { filters: [] }; }
  async findById(id: string): Promise<Property | null> {
    const p = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!p) return null;
    return { ...p, documents: this.documents.filter((d) => d.propertyId === id) };
  }
  async ownerExists(ownerId: string) { return this.owners.has(ownerId); }
  async propertyTypeExists(typeId: string) { return this.types.has(typeId); }
  async agencyExists(agencyId: string) { return this.agencies.has(agencyId); }
  async create(data: CreateUnifiedPropertyData): Promise<Property> {
    const now = new Date();
    const property = { id: `p-${this.items.length + 1}`, ...data, created_at: now, updated_at: now, deleted_at: null } as unknown as Property & { deleted_at: Date | null };
    this.items.push(property);
    return property;
  }
  async update(id: string, data: UpdateUnifiedPropertyData): Promise<Property> {
    const p = this.items.find((x) => x.id === id)!;
    Object.assign(p, data);
    return p;
  }
  async softDelete(id: string): Promise<Property | null> {
    const p = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!p) return null;
    p.deleted_at = new Date();
    return p;
  }
  async findDeletionState(id: string) {
    const p = this.items.find((x) => x.id === id);
    return p ? { title: p.title, deleted_at: p.deleted_at } : null;
  }
  async restore(id: string): Promise<Property> {
    const p = this.items.find((x) => x.id === id)!;
    p.deleted_at = null;
    return p;
  }
  async createDocuments(propertyId: string, documents: Array<{ url: string; description: string; type: string }>, featuredIdentifier?: string): Promise<void> {
    for (const doc of documents) {
      this.documents.push({ propertyId, url: doc.url, description: doc.description, type: doc.type, isFeatured: false });
    }
    if (featuredIdentifier) {
      const match = this.documents.find((d) => d.propertyId === propertyId && (d.url.includes(featuredIdentifier) || d.description === featuredIdentifier));
      if (match) {
        this.documents.filter((d) => d.propertyId === propertyId).forEach((d) => { d.isFeatured = false; });
        match.isFeatured = true;
      }
    }
  }
}

class FakeStorage implements Storage {
  uploadCount = 0;
  async upload(input: UploadInput, folder: string) { return `https://cdn.test/${folder}/${input.filename}`; }
  async delete() {}
  async uploadMedia(input: UploadInput, folder: string): Promise<UploadMediaResult> {
    this.uploadCount++;
    return { url: `https://cdn.test/${folder}/${input.filename}`, contentType: input.contentType };
  }
}

const baseData: CreateUnifiedPropertyData = {
  title: 'Casa X', bedrooms: 3, bathrooms: 2, area_total: 120, furnished: true,
  tax_registration: '123', owner_id: 'owner-1', type_id: 'type-1',
};

function seed(repo: InMemoryPropertiesRepository, over: Partial<Property> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'p-1', title: 'Casa X', bedrooms: 3, bathrooms: 2, half_bathrooms: 0, garage_spaces: 0,
    area_total: 120, area_built: 0, frontage: 0, furnished: true, tax_registration: '123',
    owner_id: 'owner-1', type_id: 'type-1', created_at: now, updated_at: now, deleted_at: null, ...over,
  } as Property & { deleted_at: Date | null });
}

describe('Property use-cases', () => {
  let repo: InMemoryPropertiesRepository;
  let storage: FakeStorage;

  beforeEach(() => {
    repo = new InMemoryPropertiesRepository();
    storage = new FakeStorage();
  });

  describe('CreateUnifiedPropertyUseCase', () => {
    it('cria imóvel sem arquivos', async () => {
      const uc = new CreateUnifiedPropertyUseCase(repo, storage);
      const out = await uc.execute({ data: baseData, files: {}, userId: 'u1' });
      expect(out.title).toBe('Casa X');
      expect(storage.uploadCount).toBe(0);
    });

    it('lança NotFound se owner não existe', async () => {
      const uc = new CreateUnifiedPropertyUseCase(repo, storage);
      await expect(uc.execute({ data: { ...baseData, owner_id: 'ghost' }, files: {}, userId: 'u1' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFound se type não existe', async () => {
      const uc = new CreateUnifiedPropertyUseCase(repo, storage);
      await expect(uc.execute({ data: { ...baseData, type_id: 'ghost' }, files: {}, userId: 'u1' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFound se agency informada não existe', async () => {
      const uc = new CreateUnifiedPropertyUseCase(repo, storage);
      await expect(uc.execute({ data: { ...baseData, agency_id: 'ghost' }, files: {}, userId: 'u1' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('exige userId', async () => {
      const uc = new CreateUnifiedPropertyUseCase(repo, storage);
      await expect(uc.execute({ data: baseData, files: {}, userId: '' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('sobe arquivos e marca a imagem destacada', async () => {
      const uc = new CreateUnifiedPropertyUseCase(repo, storage);
      const file = { buffer: Buffer.from('x'), filename: 'foto.jpg', contentType: 'image/jpeg' };
      const out = await uc.execute({
        data: baseData,
        files: { arquivosImagens: [file] },
        userId: 'u1',
        featuredImageIdentifier: 'foto.jpg',
      });
      expect(storage.uploadCount).toBe(1);
      const docs = repo.documents.filter((d) => d.propertyId === out.id);
      expect(docs).toHaveLength(1);
      expect(docs[0].isFeatured).toBe(true);
    });
  });

  describe('UpdateUnifiedPropertyUseCase', () => {
    it('lança NotFound se o imóvel não existe', async () => {
      const uc = new UpdateUnifiedPropertyUseCase(repo, storage);
      await expect(uc.execute('ghost', { data: baseData, files: {}, userId: 'u1' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('atualiza dados sem novos arquivos', async () => {
      seed(repo);
      const uc = new UpdateUnifiedPropertyUseCase(repo, storage);
      const out = await uc.execute('p-1', { data: { ...baseData, title: 'Casa Y' }, files: {}, userId: 'u1' });
      expect(out.title).toBe('Casa Y');
    });
  });

  describe('DeletePropertyUseCase', () => {
    it('lança NotFound se não existe/já excluído', async () => {
      await expect(new DeletePropertyUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('faz soft-delete', async () => {
      seed(repo);
      const out = await new DeletePropertyUseCase(repo).execute('p-1');
      expect(out.title).toBe('Casa X');
    });
  });

  describe('RestorePropertyUseCase', () => {
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestorePropertyUseCase(repo).execute('p-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura excluído', async () => {
      seed(repo, { deleted_at: new Date() });
      const out = await new RestorePropertyUseCase(repo).execute('p-1');
      expect(out.id).toBe('p-1');
    });
  });

  describe('GetPropertyByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetPropertyByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('exige ID', async () => {
      await expect(new GetPropertyByIdUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
