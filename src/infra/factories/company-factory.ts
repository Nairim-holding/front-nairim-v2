import { env } from '@/infra/config/env';
import { PrismaCompaniesRepository } from '@/infra/repositories/prisma-companies-repository';
import { minioStorage } from '@/infra/storage/minio-storage';
import { jwtService } from '@/infra/auth/jwt-service';

import {
  GetPublicBrandingUseCase,
  GetMyBrandingUseCase,
  UpdateBrandingUseCase,
  UploadBrandingAssetUseCase,
} from '@/core/use-cases/company/branding';
import {
  CheckSlugAvailabilityUseCase,
  ListCompaniesUseCase,
  GetCompanyByIdUseCase,
  CreateCompanyUseCase,
  UpdateCompanyUseCase,
  DeleteCompanyUseCase,
  RestoreCompanyUseCase,
} from '@/core/use-cases/company/crud';
import { SwitchCompanyUseCase } from '@/core/use-cases/company/switch-company';

/**
 * Composition root do módulo Company — injeta as implementações (Prisma, MinIO,
 * JWT) nos casos de uso. Actions e queries importam apenas este objeto.
 *
 * Camada: infra.
 */
const companies = new PrismaCompaniesRepository();

export const companyUseCases = {
  getPublicBranding: new GetPublicBrandingUseCase(companies),
  getMyBranding: new GetMyBrandingUseCase(companies),
  updateBranding: new UpdateBrandingUseCase(companies),
  uploadBrandingAsset: new UploadBrandingAssetUseCase(companies, minioStorage),
  checkSlug: new CheckSlugAvailabilityUseCase(companies),
  list: new ListCompaniesUseCase(companies),
  getById: new GetCompanyByIdUseCase(companies),
  create: new CreateCompanyUseCase(companies),
  update: new UpdateCompanyUseCase(companies),
  remove: new DeleteCompanyUseCase(companies),
  restore: new RestoreCompanyUseCase(companies),
  switchCompany: new SwitchCompanyUseCase(companies, jwtService, env.JWT_EXPIRES_IN),
};
