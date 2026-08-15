import prisma from '@/infra/database/prisma';
import type { CompaniesRepository } from '@/core/repositories/companies-repository';
import type {
  BrandingAssetField,
  BrandingData,
  CompanyBranding,
  CompanyListResult,
  CompanyWithBranding,
  PublicBranding,
} from '@/core/entities/company';

/**
 * Implementação Prisma de {@link CompaniesRepository}.
 *
 * `Company`/`CompanyBranding` NÃO são tenant-scoped → as queries rodam sem
 * injeção de `company_id`, podendo ser usadas fora de contexto (login, branding
 * público, switch).
 *
 * Inclui o cache em memória do branding público por slug (TTL 60s) portado do
 * CompanyService, com invalidação explícita em update/upload.
 *
 * Camada: infra.
 * Origem: api-nairim-v2/src/services/CompanyService.ts.
 */

// ─── Cache de branding público por slug ──────────────────────────────────────
const BRANDING_CACHE_TTL_MS = 60_000;
const globalForCache = globalThis as unknown as {
  brandingCache?: Map<string, { data: PublicBranding; expiresAt: number }>;
};
const brandingCache = globalForCache.brandingCache ?? new Map();
globalForCache.brandingCache = brandingCache;

function invalidateBySlug(slug: string) {
  brandingCache.delete(slug);
}
async function invalidateByCompanyId(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  if (company?.slug) invalidateBySlug(company.slug);
}

export class PrismaCompaniesRepository implements CompaniesRepository {
  async findSlugById(id: string): Promise<string | null> {
    const company = await prisma.company.findUnique({ where: { id }, select: { slug: true } });
    return company?.slug ?? null;
  }

  // ─── Validação de slug ──────────────────────────────────────────────────
  async checkSlugExists(slug: string): Promise<boolean> {
    const company = await prisma.company.findUnique({ where: { slug } });
    return !!company;
  }

  async slugExistsExcept(slug: string, exceptId: string): Promise<boolean> {
    const company = await prisma.company.findFirst({ where: { slug, NOT: { id: exceptId } } });
    return !!company;
  }

  // ─── Branding ───────────────────────────────────────────────────────────
  async getBrandingBySlug(slug: string): Promise<PublicBranding | null> {
    const cached = brandingCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const company = await prisma.company.findFirst({
      where: { slug, is_active: true, deleted_at: null },
      include: { branding: true },
    });
    if (!company) return null;

    const data = { company, branding: company.branding } as unknown as PublicBranding;
    brandingCache.set(slug, { data, expiresAt: Date.now() + BRANDING_CACHE_TTL_MS });
    return data;
  }

  async getBrandingByCompanyId(companyId: string): Promise<CompanyBranding | null> {
    const branding = await prisma.companyBranding.findUnique({ where: { company_id: companyId } });
    return branding as unknown as CompanyBranding | null;
  }

  async upsertBranding(companyId: string, data: BrandingData): Promise<CompanyBranding> {
    const branding = await prisma.companyBranding.upsert({
      where: { company_id: companyId },
      update: { ...(data as any), updated_at: new Date() },
      create: { company_id: companyId, ...(data as any) },
    });
    await invalidateByCompanyId(companyId);
    return branding as unknown as CompanyBranding;
  }

  async upsertBrandingAsset(companyId: string, field: BrandingAssetField, url: string): Promise<string> {
    await prisma.companyBranding.upsert({
      where: { company_id: companyId },
      update: { [field]: url, updated_at: new Date() } as any,
      create: { company_id: companyId, [field]: url } as any,
    });
    await invalidateByCompanyId(companyId);
    return url;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────
  async list(params: { page: number; limit: number; search: string; includeInactive: boolean }): Promise<CompanyListResult> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;

    const where: any = {};
    if (!params.includeInactive) where.deleted_at = null;
    if (params.search.trim()) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { slug: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, count] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          branding: {
            select: { company_name: true, trade_name: true, logo_url: true, logo_dark_url: true, primary_color: true },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return {
      data: data as unknown as CompanyWithBranding[],
      count,
      totalPages: Math.ceil(count / take),
      currentPage: params.page,
    };
  }

  async findByIdWithBranding(id: string): Promise<CompanyWithBranding | null> {
    const company = await prisma.company.findUnique({ where: { id }, include: { branding: true } });
    return company as unknown as CompanyWithBranding | null;
  }

  async create(data: { name: string; slug: string } & BrandingData): Promise<CompanyWithBranding> {
    const { name, slug, ...branding } = data;
    const hasBranding = Object.values(branding).some((v) => v !== undefined);

    const company = await prisma.company.create({
      data: {
        name,
        slug,
        is_active: true,
        ...(hasBranding ? { branding: { create: { ...(branding as any) } } } : {}),
      },
      include: { branding: true },
    });
    return company as unknown as CompanyWithBranding;
  }

  async update(id: string, data: { name?: string; slug?: string; is_active?: boolean } & BrandingData): Promise<CompanyWithBranding> {
    const { name, slug, is_active, ...branding } = data;
    const hasBranding = Object.values(branding).some((v) => v !== undefined);

    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
        ...(hasBranding
          ? {
              branding: {
                upsert: {
                  create: { ...(branding as any) },
                  update: { ...(branding as any), updated_at: new Date() },
                },
              },
            }
          : {}),
      },
      include: { branding: true },
    });
    if (hasBranding) invalidateBySlug(updated.slug);
    return updated as unknown as CompanyWithBranding;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.company.update({ where: { id }, data: { deleted_at: new Date(), is_active: false } });
  }

  async restore(id: string): Promise<CompanyWithBranding> {
    const company = await prisma.company.update({
      where: { id },
      data: { deleted_at: null, is_active: true },
      include: { branding: true },
    });
    return company as unknown as CompanyWithBranding;
  }
}
