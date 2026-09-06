import { PrismaLeaseCreditReconciliationRepository } from '@/infra/repositories/prisma-lease-credit-reconciliation-repository';
import {
  CompleteLeaseCreditReconciliationUseCase,
  SearchLeaseCreditCandidatesUseCase,
} from '@/core/use-cases/financial-transaction/lease-credit-reconciliation';

const repository = new PrismaLeaseCreditReconciliationRepository();

export const leaseCreditReconciliationUseCases = {
  search: new SearchLeaseCreditCandidatesUseCase(repository),
  complete: new CompleteLeaseCreditReconciliationUseCase(repository),
};
