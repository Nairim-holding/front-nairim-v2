import { prismaLeaseReportsRepository } from '@/infra/repositories/prisma-lease-reports-repository';
import type { LeaseReportsRepository } from '@/core/repositories/lease-reports-repository';

/** Composition root do Relatório de Locações. Camada: infra. */
export const leaseReportsRepository: LeaseReportsRepository = prismaLeaseReportsRepository;
