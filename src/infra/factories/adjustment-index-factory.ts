import { PrismaAdjustmentIndexesRepository } from '@/infra/repositories/prisma-adjustment-indexes-repository';
import { fetchAdjustmentIndexSeries } from '@/infra/services/bcb-sgs-client';
import {
  CreateAdjustmentIndexUseCase,
  DeleteAdjustmentIndexUseCase,
  DeleteAdjustmentIndexValueUseCase,
  GetAdjustmentIndexByIdUseCase,
  ListAdjustmentIndexOptionsUseCase,
  ListAdjustmentIndexesUseCase,
  SeedAdjustmentIndexesUseCase,
  SyncAdjustmentIndexesUseCase,
  UpdateAdjustmentIndexUseCase,
  UpsertAdjustmentIndexValueUseCase,
} from '@/core/use-cases/adjustment-index/crud';

/** Composition root dos Índices de Reajuste (Etapa 4). Camada: infra. */
const indexes = new PrismaAdjustmentIndexesRepository();

export const adjustmentIndexUseCases = {
  list: new ListAdjustmentIndexesUseCase(indexes),
  getById: new GetAdjustmentIndexByIdUseCase(indexes),
  listOptions: new ListAdjustmentIndexOptionsUseCase(indexes),
  create: new CreateAdjustmentIndexUseCase(indexes),
  update: new UpdateAdjustmentIndexUseCase(indexes),
  remove: new DeleteAdjustmentIndexUseCase(indexes),
  seed: new SeedAdjustmentIndexesUseCase(indexes),
  upsertValue: new UpsertAdjustmentIndexValueUseCase(indexes),
  deleteValue: new DeleteAdjustmentIndexValueUseCase(indexes),
  // O cliente do BCB entra aqui: o core recebe a função e não conhece infra.
  sync: new SyncAdjustmentIndexesUseCase(indexes, fetchAdjustmentIndexSeries),
};
