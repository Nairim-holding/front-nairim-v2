import prisma from '@/infra/database/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { PublicRepository } from '@/core/repositories/public-repository';
import { paginatePublic, publicMeta } from '@/core/utils/public-pagination';
import type {
  PublicAgency,
  PublicCompany,
  PublicOwner,
  PublicPaginated,
  PublicProperty,
  PublicPropertyType,
} from '@/core/entities/public-property';

/**
 * Implementação Prisma de {@link PublicRepository}.
 * Porte fiel de api-nairim-v2/src/services/PublicService.ts.
 *
 * Tenant: o chamador deve ter resolvido o slug e rodado `runWithTenant(companyId)`
 * (equivale ao middleware `resolveCompanyBySlug`). A extensão injeta `company_id`
 * automaticamente em Property/Owner/PropertyType/Agency.
 *
 * FIDELIDADE:
 *  - Seleção mínima `PUBLIC_PROPERTY_SELECT` (imagens apenas, endereços compactos,
 *    valor mais recente).
 *  - `paginate` clampea limit em [1, 100] e meta `totalPages` com mínimo 1.
 *  - `onlyAvailable` adiciona `values.some({status:'AVAILABLE', deleted_at:null})`.
 *  - Search OR em título/cidade/bairro (case-insensitive).
 *  - Ordenações: property.created_at desc; owner/type/agency por nome asc.
 *
 * Camada: infra.
 */

/** Seleção mínima pública — igual ao `PUBLIC_PROPERTY_SELECT` do backend. */
const PUBLIC_PROPERTY_SELECT = {
  id: true,
  title: true,
  registration_number: true,
  bedrooms: true,
  bathrooms: true,
  half_bathrooms: true,
  garage_spaces: true,
  area_total: true,
  area_built: true,
  frontage: true,
  furnished: true,
  floor_number: true,
  notes: true,
  created_at: true,
  type: { select: { id: true, description: true } },
  agency: { select: { id: true, trade_name: true } },
  addresses: {
    where: { deleted_at: null },
    select: {
      address: {
        select: {
          street: true,
          number: true,
          district: true,
          city: true,
          state: true,
          country: true,
        },
      },
    },
  },
  documents: {
    where: { deleted_at: null, type: 'IMAGE' as const },
    select: { id: true, file_path: true, description: true, is_featured: true },
  },
  values: {
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' as const },
    take: 1,
    select: {
      status: true,
      rental_value: true,
      sale_value: true,
      condo_fee: true,
      property_tax: true,
    },
  },
} satisfies Prisma.PropertySelect;

export class PrismaPublicRepository implements PublicRepository {
  async getCompanyBySlug(slug: string): Promise<PublicCompany | null> {
    const company = await prisma.company.findFirst({
      where: { slug, is_active: true, deleted_at: null },
      select: { id: true, name: true, slug: true },
    });
    return company;
  }

  async getProperties(
    params: { limit?: number; page?: number; search?: string; onlyAvailable?: boolean } = {},
  ): Promise<PublicPaginated<PublicProperty>> {
    const { limit = 12, page = 1, search = '', onlyAvailable = false } = params;
    const { take, skip } = paginatePublic(limit, page);

    const where: Prisma.PropertyWhereInput = {
      deleted_at: null,
      ...(onlyAvailable ? { values: { some: { status: 'AVAILABLE', deleted_at: null } } } : {}),
      ...(search.trim()
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
              { addresses: { some: { address: { city: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } } } },
              { addresses: { some: { address: { district: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } } } },
            ],
          }
        : {}),
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        select: PUBLIC_PROPERTY_SELECT,
        orderBy: { created_at: 'desc' },
        take,
        skip,
      }),
      prisma.property.count({ where }),
    ]);

    return {
      items: properties as unknown as PublicProperty[],
      meta: publicMeta(total, page, take),
    };
  }

  async getPropertyById(id: string): Promise<PublicProperty | null> {
    return prisma.property.findFirst({
      where: { id, deleted_at: null },
      select: PUBLIC_PROPERTY_SELECT,
    }) as unknown as Promise<PublicProperty | null>;
  }

  async getOwners(params: { limit?: number; page?: number; search?: string } = {}): Promise<PublicPaginated<PublicOwner>> {
    const { limit = 50, page = 1, search = '' } = params;
    const { take, skip } = paginatePublic(limit, page);

    const where: Prisma.OwnerWhereInput = {
      deleted_at: null,
      ...(search.trim() ? { name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } : {}),
    };

    const [owners, total] = await Promise.all([
      prisma.owner.findMany({
        where,
        select: { id: true, name: true, internal_code: true },
        orderBy: { name: 'asc' },
        take,
        skip,
      }),
      prisma.owner.count({ where }),
    ]);

    return {
      items: owners as unknown as PublicOwner[],
      meta: publicMeta(total, page, take),
    };
  }

  async getPropertyTypes(params: { limit?: number; page?: number; search?: string } = {}): Promise<PublicPaginated<PublicPropertyType>> {
    const { limit = 50, page = 1, search = '' } = params;
    const { take, skip } = paginatePublic(limit, page);

    const where: Prisma.PropertyTypeWhereInput = {
      deleted_at: null,
      ...(search.trim() ? { description: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } : {}),
    };

    const [types, total] = await Promise.all([
      prisma.propertyType.findMany({
        where,
        select: { id: true, description: true },
        orderBy: { description: 'asc' },
        take,
        skip,
      }),
      prisma.propertyType.count({ where }),
    ]);

    return {
      items: types as unknown as PublicPropertyType[],
      meta: publicMeta(total, page, take),
    };
  }

  async getAgencies(params: { limit?: number; page?: number; search?: string } = {}): Promise<PublicPaginated<PublicAgency>> {
    const { limit = 50, page = 1, search = '' } = params;
    const { take, skip } = paginatePublic(limit, page);

    const where: Prisma.AgencyWhereInput = {
      deleted_at: null,
      ...(search.trim() ? { trade_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } : {}),
    };

    const [agencies, total] = await Promise.all([
      prisma.agency.findMany({
        where,
        select: { id: true, trade_name: true },
        orderBy: { trade_name: 'asc' },
        take,
        skip,
      }),
      prisma.agency.count({ where }),
    ]);

    return {
      items: agencies as unknown as PublicAgency[],
      meta: publicMeta(total, page, take),
    };
  }
}