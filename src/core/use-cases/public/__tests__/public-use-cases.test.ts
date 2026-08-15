import { describe, it, expect, vi } from 'vitest';
import type { PublicRepository } from '@/core/repositories/public-repository';
import type {
  PublicAgency,
  PublicCompany,
  PublicOwner,
  PublicPaginated,
  PublicProperty,
  PublicPropertyType,
} from '@/core/entities/public-property';
import {
  GetAvailablePropertiesUseCase,
  GetPublicAgenciesUseCase,
  GetPublicCompanyBySlugUseCase,
  GetPublicOwnersUseCase,
  GetPublicPropertiesUseCase,
  GetPublicPropertyByIdUseCase,
  GetPublicPropertyTypesUseCase,
} from '@/core/use-cases/public/crud';
import { paginatePublic, publicMeta } from '@/core/utils/public-pagination';
import { parsePublicListParams } from '@/shared/validators/public';

/**
 * Testes do módulo Public (Módulo 12) — parte vitrine `/public/:companySlug`.
 *  - `paginatePublic`: fidelidade ao `paginate` do PublicService (clamp [1,100]).
 *  - `parsePublicListParams`: fidelidade ao `PublicController.listParams`.
 *  - Delegação dos use-cases ao repositório (incl. `onlyAvailable` e company por slug).
 */

function emptyPaginated<T>(items: T[]): PublicPaginated<T> {
  return { items, meta: { total: 0, page: 1, limit: 12, totalPages: 1 } };
}

class InMemoryPublicRepository implements PublicRepository {
  last: { method: string; params?: unknown }[] = [];

  company: PublicCompany | null = null;
  properties = emptyPaginated<PublicProperty>([]);
  owners = emptyPaginated<PublicOwner>([]);
  types = emptyPaginated<PublicPropertyType>([]);
  agencies = emptyPaginated<PublicAgency>([]);
  property: PublicProperty | null = null;

  async getCompanyBySlug(slug: string): Promise<PublicCompany | null> {
    this.last.push({ method: 'getCompanyBySlug', params: { slug } });
    return this.company;
  }
  async getProperties(params: { limit?: number; page?: number; search?: string; onlyAvailable?: boolean }): Promise<PublicPaginated<PublicProperty>> {
    this.last.push({ method: 'getProperties', params });
    return this.properties;
  }
  async getPropertyById(id: string): Promise<PublicProperty | null> {
    this.last.push({ method: 'getPropertyById', params: { id } });
    return this.property;
  }
  async getOwners(params: { limit?: number; page?: number; search?: string }): Promise<PublicPaginated<PublicOwner>> {
    this.last.push({ method: 'getOwners', params });
    return this.owners;
  }
  async getPropertyTypes(params: { limit?: number; page?: number; search?: string }): Promise<PublicPaginated<PublicPropertyType>> {
    this.last.push({ method: 'getPropertyTypes', params });
    return this.types;
  }
  async getAgencies(params: { limit?: number; page?: number; search?: string }): Promise<PublicPaginated<PublicAgency>> {
    this.last.push({ method: 'getAgencies', params });
    return this.agencies;
  }
}

describe('paginatePublic (fidelidade ao PublicService.paginate)', () => {
  it('usa defaults limit=12 e page=1', () => {
    expect(paginatePublic()).toEqual({ take: 12, skip: 0 });
  });

  it('clampea limit entre 1 e 100', () => {
    expect(paginatePublic(0, 1).take).toBe(1);
    expect(paginatePublic(1000, 1).take).toBe(100);
    expect(paginatePublic(10, 3)).toEqual({ take: 10, skip: 20 });
  });

  it('page mínima é 1', () => {
    expect(paginatePublic(10, 0)).toEqual({ take: 10, skip: 0 });
  });
});

describe('publicMeta (fidelidade ao backend)', () => {
  it('totalPages mínimo 1', () => {
    expect(publicMeta(0, 1, 12).totalPages).toBe(1);
  });

  it('calcula totalPages corretamente', () => {
    expect(publicMeta(25, 1, 12).totalPages).toBe(3);
    expect(publicMeta(24, 1, 12).totalPages).toBe(2);
  });
});

describe('parsePublicListParams (fidelidade ao PublicController.listParams)', () => {
  it('usa defaults (limit 12, page 1, search "")', () => {
    expect(parsePublicListParams({})).toEqual({ limit: 12, page: 1, search: '' });
  });

  it('parseia valores válidos', () => {
    expect(parsePublicListParams({ limit: '50', page: '2', search: 'centro' })).toEqual({
      limit: 50,
      page: 2,
      search: 'centro',
    });
  });

  it('usa default em valores não numéricos', () => {
    expect(parsePublicListParams({ limit: 'abc', page: 'x' })).toEqual({ limit: 12, page: 1, search: '' });
  });

  it('respeita defaultLimit (ex.: 50 p/ owners/types/agencies)', () => {
    expect(parsePublicListParams({}, 50).limit).toBe(50);
  });
});

describe('Public use-cases', () => {
  it('GetPublicCompanyBySlugUseCase delega e retorna a empresa', async () => {
    const repo = new InMemoryPublicRepository();
    repo.company = { id: 'c1', name: 'Nairim', slug: 'nairim' };
    const result = await new GetPublicCompanyBySlugUseCase(repo).execute('nairim');
    expect(result?.slug).toBe('nairim');
    expect(repo.last[0]).toEqual({ method: 'getCompanyBySlug', params: { slug: 'nairim' } });
  });

  it('GetAvailablePropertiesUseCase força onlyAvailable=true', async () => {
    const repo = new InMemoryPublicRepository();
    await new GetAvailablePropertiesUseCase(repo).execute({ limit: 5 });
    expect(repo.last[0]).toEqual({
      method: 'getProperties',
      params: { limit: 5, onlyAvailable: true },
    });
  });

  it('GetPublicPropertiesUseCase delega sem onlyAvailable', async () => {
    const repo = new InMemoryPublicRepository();
    await new GetPublicPropertiesUseCase(repo).execute({ limit: 12 });
    expect(repo.last[0]).toEqual({ method: 'getProperties', params: { limit: 12 } });
  });

  it('GetPublicPropertyByIdUseCase delega o id', async () => {
    const repo = new InMemoryPublicRepository();
    repo.property = {} as PublicProperty;
    const result = await new GetPublicPropertyByIdUseCase(repo).execute('p1');
    expect(result).toBe(repo.property);
    expect(repo.last[0]).toEqual({ method: 'getPropertyById', params: { id: 'p1' } });
  });

  it('GetPublicOwnersUseCase delega', async () => {
    const repo = new InMemoryPublicRepository();
    await new GetPublicOwnersUseCase(repo).execute({ search: 'joao' });
    expect(repo.last[0]).toEqual({ method: 'getOwners', params: { search: 'joao' } });
  });

  it('GetPublicPropertyTypesUseCase delega', async () => {
    const repo = new InMemoryPublicRepository();
    await new GetPublicPropertyTypesUseCase(repo).execute({});
    expect(repo.last[0]).toEqual({ method: 'getPropertyTypes', params: {} });
  });

  it('GetPublicAgenciesUseCase delega', async () => {
    const repo = new InMemoryPublicRepository();
    await new GetPublicAgenciesUseCase(repo).execute({});
    expect(repo.last[0]).toEqual({ method: 'getAgencies', params: {} });
  });
});