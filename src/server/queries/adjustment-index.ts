import 'server-only';
import { adjustmentIndexUseCases } from '@/infra/factories/adjustment-index-factory';
import { withPermission } from '@/infra/auth/session';
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
  return withPermission('adjustment-indexes', 'view', () => adjustmentIndexUseCases.list.execute(params));
}

export async function getAdjustmentIndexByIdData(id: string): Promise<AdjustmentIndex | null> {
  return withPermission('adjustment-indexes', 'view', () => adjustmentIndexUseCases.getById.execute(id));
}

/** Opções do ComboBox "Índice de Reajuste" da aba Valores da Locação. */
export async function listAdjustmentIndexOptionsData(): Promise<Array<{ label: string; value: string }>> {
  return withPermission('adjustment-indexes', 'view', () => adjustmentIndexUseCases.listOptions.execute());
}
