import { describe, it, expect, beforeEach } from 'vitest';
import type { CompaniesRepository } from '@/core/repositories/companies-repository';
import type { Storage, UploadInput } from '@/core/storage/storage';
import type { TokenSigner } from '@/core/cryptography/token-signer';
import type {
  BrandingAssetField, BrandingData, CompanyBranding, CompanyListResult, CompanyWithBranding, PublicBranding,
} from '@/core/entities/company';
import {
  CreateCompanyUseCase, UpdateCompanyUseCase, DeleteCompanyUseCase,
  CheckSlugAvailabilityUseCase, GetCompanyByIdUseCase,
} from '@/core/use-cases/company/crud';
import { UploadBrandingAssetUseCase, GetPublicBrandingUseCase } from '@/core/use-cases/company/branding';
import { SwitchCompanyUseCase } from '@/core/use-cases/company/switch-company';
import { ValidationError, NotFoundError, ConflictError } from '@/core/errors/domain-errors';

/** Repositório de empresas em memória (implementa o contrato completo). */
class InMemoryCompaniesRepository implements CompaniesRepository {
  companies: CompanyWithBranding[] = [];

  private make(id: string, name: string, slug: string): CompanyWithBranding {
    return { id, name, slug, is_active: true, created_at: new Date(), updated_at: new Date(), deleted_at: null, branding: null };
  }
  async findSlugById(id: string) { return this.companies.find((c) => c.id === id)?.slug ?? null; }
  async checkSlugExists(slug: string) { return this.companies.some((c) => c.slug === slug); }
  async slugExistsExcept(slug: string, exceptId: string) { return this.companies.some((c) => c.slug === slug && c.id !== exceptId); }
  async getBrandingBySlug(slug: string): Promise<PublicBranding | null> {
    const c = this.companies.find((x) => x.slug === slug && x.is_active && !x.deleted_at);
    return c ? { company: c, branding: c.branding } : null;
  }
  async getBrandingByCompanyId(companyId: string) { return this.companies.find((c) => c.id === companyId)?.branding ?? null; }
  async upsertBranding(companyId: string, data: BrandingData): Promise<CompanyBranding> {
    const c = this.companies.find((x) => x.id === companyId)!;
    c.branding = { ...(c.branding ?? { company_id: companyId }), ...data } as CompanyBranding;
    return c.branding;
  }
  async upsertBrandingAsset(companyId: string, field: BrandingAssetField, url: string) {
    const c = this.companies.find((x) => x.id === companyId)!;
    c.branding = { ...(c.branding ?? { company_id: companyId }), [field]: url } as CompanyBranding;
    return url;
  }
  async list(): Promise<CompanyListResult> {
    return { data: this.companies, count: this.companies.length, totalPages: 1, currentPage: 1 };
  }
  async findByIdWithBranding(id: string) { return this.companies.find((c) => c.id === id) ?? null; }
  async create(data: { name: string; slug: string } & BrandingData): Promise<CompanyWithBranding> {
    const c = this.make(`c-${this.companies.length + 1}`, data.name, data.slug);
    this.companies.push(c);
    return c;
  }
  async update(id: string, data: { name?: string; slug?: string; is_active?: boolean } & BrandingData): Promise<CompanyWithBranding> {
    const c = this.companies.find((x) => x.id === id)!;
    if (data.name) c.name = data.name;
    if (data.slug) c.slug = data.slug;
    if (data.is_active !== undefined) c.is_active = data.is_active;
    return c;
  }
  async softDelete(id: string) { const c = this.companies.find((x) => x.id === id); if (c) { c.deleted_at = new Date(); c.is_active = false; } }
  async restore(id: string): Promise<CompanyWithBranding> { const c = this.companies.find((x) => x.id === id)!; c.deleted_at = null; c.is_active = true; return c; }
}

class FakeStorage implements Storage {
  async upload(input: UploadInput, folder: string) { return `https://cdn.test/${folder}/${input.filename}`; }
  async delete() {}
  async uploadMedia(input: UploadInput, folder: string) { return { url: `https://cdn.test/${folder}/${input.filename}`, contentType: input.contentType }; }
}

class FakeTokenSigner implements TokenSigner {
  sign(payload: Record<string, unknown>) { return 'tok:' + JSON.stringify(payload); }
  verify<T>(t: string) { return JSON.parse(t.replace(/^tok:/, '')) as T; }
  verifyIgnoringExpiration<T>(t: string) { return JSON.parse(t.replace(/^tok:/, '')) as T; }
}

const img = (over: Partial<UploadInput> = {}): UploadInput => ({
  buffer: Buffer.from('x'), filename: 'logo.png', contentType: 'image/png', size: 1024, ...over,
});

describe('Company use-cases', () => {
  let repo: InMemoryCompaniesRepository;
  beforeEach(() => { repo = new InMemoryCompaniesRepository(); });

  describe('CreateCompanyUseCase', () => {
    it('cria empresa normalizando o slug', async () => {
      const uc = new CreateCompanyUseCase(repo);
      const c = await uc.execute({ name: 'Nairim', slug: '  Nairim  ' });
      expect(c.slug).toBe('nairim');
    });
    it('exige name e slug', async () => {
      const uc = new CreateCompanyUseCase(repo);
      await expect(uc.execute({ name: 'x' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita slug duplicado (409)', async () => {
      repo.companies.push({ id: 'c1', name: 'A', slug: 'nairim', is_active: true, created_at: new Date(), updated_at: new Date(), deleted_at: null, branding: null });
      const uc = new CreateCompanyUseCase(repo);
      await expect(uc.execute({ name: 'B', slug: 'nairim' })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('UpdateCompanyUseCase', () => {
    it('lança NotFound se a empresa não existe', async () => {
      const uc = new UpdateCompanyUseCase(repo);
      await expect(uc.execute('ghost', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita mudar para slug já usado por outra empresa', async () => {
      repo.companies.push({ id: 'c1', name: 'A', slug: 'a', is_active: true, created_at: new Date(), updated_at: new Date(), deleted_at: null, branding: null });
      repo.companies.push({ id: 'c2', name: 'B', slug: 'b', is_active: true, created_at: new Date(), updated_at: new Date(), deleted_at: null, branding: null });
      const uc = new UpdateCompanyUseCase(repo);
      await expect(uc.execute('c2', { slug: 'a' })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('DeleteCompanyUseCase', () => {
    it('lança NotFound se a empresa não existe', async () => {
      const uc = new DeleteCompanyUseCase(repo);
      await expect(uc.execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('faz soft-delete', async () => {
      repo.companies.push({ id: 'c1', name: 'A', slug: 'a', is_active: true, created_at: new Date(), updated_at: new Date(), deleted_at: null, branding: null });
      await new DeleteCompanyUseCase(repo).execute('c1');
      expect(repo.companies[0].deleted_at).not.toBeNull();
      expect(repo.companies[0].is_active).toBe(false);
    });
  });

  describe('CheckSlugAvailabilityUseCase', () => {
    it('retorna available=false quando o slug existe', async () => {
      repo.companies.push({ id: 'c1', name: 'A', slug: 'nairim', is_active: true, created_at: new Date(), updated_at: new Date(), deleted_at: null, branding: null });
      const out = await new CheckSlugAvailabilityUseCase(repo).execute('NAIRIM');
      expect(out.available).toBe(false);
    });
    it('exige slug', async () => {
      await expect(new CheckSlugAvailabilityUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('UploadBrandingAssetUseCase', () => {
    it('sobe imagem válida e grava a URL', async () => {
      repo.companies.push({ id: 'c1', name: 'A', slug: 'a', is_active: true, created_at: new Date(), updated_at: new Date(), deleted_at: null, branding: null });
      const uc = new UploadBrandingAssetUseCase(repo, new FakeStorage());
      const out = await uc.execute({ companyId: 'c1', file: img(), field: 'logo_url', maxSizeMB: 5 });
      expect(out.url).toContain('companies/c1');
      expect(repo.companies[0].branding?.logo_url).toBe(out.url);
    });
    it('rejeita arquivo que não é imagem', async () => {
      const uc = new UploadBrandingAssetUseCase(repo, new FakeStorage());
      await expect(uc.execute({ companyId: 'c1', file: img({ contentType: 'application/pdf' }), field: 'logo_url', maxSizeMB: 5 })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita arquivo acima do limite', async () => {
      const uc = new UploadBrandingAssetUseCase(repo, new FakeStorage());
      await expect(uc.execute({ companyId: 'c1', file: img({ size: 6 * 1024 * 1024 }), field: 'logo_url', maxSizeMB: 5 })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('GetPublicBrandingUseCase', () => {
    it('exige slug', async () => {
      await expect(new GetPublicBrandingUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança NotFound se a empresa não existe', async () => {
      await expect(new GetPublicBrandingUseCase(repo).execute('inexistente')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('SwitchCompanyUseCase', () => {
    const user = { id: 'u1', name: 'M', email: 'm@x', role: 'SUPER_ADMIN' };
    it.each(['DEFAULT', 'ADMIN', 'administrador', 'usuário'])('recusa troca de empresa por %s', async (role) => {
      const uc = new SwitchCompanyUseCase(repo, new FakeTokenSigner(), '12h');
      await expect(uc.execute({ ...user, role }, 'destino')).rejects.toMatchObject({ statusCode: 403 });
    });
    it('emite novo token com a empresa destino', async () => {
      repo.companies.push({ id: 'c9', name: 'Destino', slug: 'destino', is_active: true, created_at: new Date(), updated_at: new Date(), deleted_at: null, branding: null });
      const uc = new SwitchCompanyUseCase(repo, new FakeTokenSigner(), '12h');
      const out = await uc.execute(user, 'destino');
      expect(out.company.id).toBe('c9');
      expect(out.user.company_id).toBe('c9');
      const payload = JSON.parse(out.token.replace(/^tok:/, ''));
      expect(payload.company_id).toBe('c9');
    });
    it('lança NotFound para empresa inexistente/inativa', async () => {
      const uc = new SwitchCompanyUseCase(repo, new FakeTokenSigner(), '12h');
      await expect(uc.execute(user, 'nada')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
