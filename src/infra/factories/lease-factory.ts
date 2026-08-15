import { PrismaLeasesRepository } from '@/infra/repositories/prisma-leases-repository';
import { PrismaLeaseFinanceRepository } from '@/infra/repositories/prisma-lease-finance-repository';
import { minioStorage } from '@/infra/storage/minio-storage';
import {
  ListLeasesUseCase, GetLeaseFiltersUseCase, GetLeaseByIdUseCase,
  CreateLeaseUseCase, UpdateLeaseUseCase, DeleteLeaseUseCase,
  PermanentlyDeleteLeaseUseCase, RestoreLeaseUseCase,
} from '@/core/use-cases/lease/crud';
import { GetCancellationPreviewUseCase, CancelLeaseUseCase } from '@/core/use-cases/lease/cancellation';
import { UpdateLeaseDocumentsUseCase } from '@/core/use-cases/lease/documents';

/** Composition root do módulo Leases. Camada: infra. */
const leases = new PrismaLeasesRepository();
const finance = new PrismaLeaseFinanceRepository();

export const leaseUseCases = {
  list: new ListLeasesUseCase(leases),
  getFilters: new GetLeaseFiltersUseCase(leases),
  getById: new GetLeaseByIdUseCase(leases),
  create: new CreateLeaseUseCase(leases, finance),
  update: new UpdateLeaseUseCase(leases, finance),
  remove: new DeleteLeaseUseCase(leases),
  permanentlyRemove: new PermanentlyDeleteLeaseUseCase(leases),
  restore: new RestoreLeaseUseCase(leases),
  getCancellationPreview: new GetCancellationPreviewUseCase(leases),
  cancel: new CancelLeaseUseCase(leases),
  updateDocuments: new UpdateLeaseDocumentsUseCase(leases, minioStorage),
};
