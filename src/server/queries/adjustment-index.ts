import 'server-only';
import { adjustmentIndexUseCases } from '@/infra/factories/adjustment-index-factory';
import { withTenant } from '@/infra/auth/session';
import { listAdjustmentIndexesQuerySchema } from '@/shared/validators/adjustment-index';
import type { AdjustmentIndex, PaginatedAdjustmentIndexes } from '@/core/entities/adjustment-index';

/**
 * Queries (leitura) dos Índices de Reajuste — para Server Components.
 * Guarda: `withTenant`. Camada: server.
 */

export async function listAdjustmentIndexesData(
  raw: Record<string, unknown>,
): Promise<PaginatedAdjustmentIndexes> {
  const params = listAdjustmentIndexesQuerySchema.parse(raw ?? {});
  return withTenant(() => adjustmentIndexUseCases.list.execute(params));
}

export async function getAdjustmentIndexByIdData(id: string): Promise<AdjustmentIndex | null> {
  return withTenant(() => adjustmentIndexUseCases.getById.execute(id));
}

/** Opções do ComboBox "Índice de Reajuste" da aba Valores da Locação. */
export async function listAdjustmentIndexOptionsData(): Promise<Array<{ label: string; value: string }>> {
  return withTenant(() => adjustmentIndexUseCases.listOptions.execute());
}
