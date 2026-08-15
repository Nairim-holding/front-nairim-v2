import type { CompaniesRepository } from '@/core/repositories/companies-repository';
import type { Storage, UploadInput } from '@/core/storage/storage';
import type { BrandingAssetField, BrandingData, CompanyBranding, PublicBranding } from '@/core/entities/company';
import { ValidationError, NotFoundError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Branding (white-label).
 * Camada: core.
 * Origem: api-nairim-v2/src/services/CompanyService.ts (branding) + CompanyController.
 */

/** Branding público por slug (vitrine/tema). Origem: getPublicBranding. */
export class GetPublicBrandingUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(slug: string): Promise<PublicBranding> {
    if (!slug?.trim()) throw new ValidationError('Parâmetro "slug" é obrigatório');
    const data = await this.companies.getBrandingBySlug(slug);
    if (!data) throw new NotFoundError('Empresa não encontrada');
    return data;
  }
}

/** Branding da empresa autenticada. Origem: getMyBranding. */
export class GetMyBrandingUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(companyId: string): Promise<CompanyBranding | null> {
    return this.companies.getBrandingByCompanyId(companyId);
  }
}

/** Atualiza o branding da empresa. Origem: updateBranding. */
export class UpdateBrandingUseCase {
  constructor(private readonly companies: CompaniesRepository) {}
  async execute(companyId: string, data: BrandingData): Promise<CompanyBranding> {
    return this.companies.upsertBranding(companyId, data);
  }
}

/** Entrada do upload de asset de branding. */
export interface UploadBrandingAssetInput {
  companyId: string;
  file: UploadInput;
  field: BrandingAssetField;
  /** Limite de tamanho em MB (5 para logos/favicon, 10 para OG image). */
  maxSizeMB: number;
}

/**
 * Envia um asset de branding (logo, favicon, etc.) para o storage e grava a URL.
 * Valida que é imagem e o limite de tamanho (como `validateBrandingImage` do backend).
 * Origem: uploadBrandingAsset / uploadLogo / uploadFavicon / ...
 */
export class UploadBrandingAssetUseCase {
  constructor(
    private readonly companies: CompaniesRepository,
    private readonly storage: Storage,
  ) {}

  async execute({ companyId, file, field, maxSizeMB }: UploadBrandingAssetInput): Promise<{ url: string }> {
    if (!file.contentType.startsWith('image/')) {
      throw new ValidationError('Arquivo deve ser uma imagem');
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new ValidationError(`Arquivo excede o limite de ${maxSizeMB}MB`);
    }

    const url = await this.storage.upload(file, `companies/${companyId}`);
    await this.companies.upsertBrandingAsset(companyId, field, url);
    return { url };
  }
}
