'use server';

import { adjustmentIndexUseCases } from '@/infra/factories/adjustment-index-factory';
import {
  createAdjustmentIndexSchema,
  syncAdjustmentIndexesSchema,
  updateAdjustmentIndexSchema,
  upsertAdjustmentIndexValueSchema,
} from '@/shared/validators/adjustment-index';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type {
  AdjustmentIndex,
  PaginatedAdjustmentIndexes,
  SyncResult,
} from '@/core/entities/adjustment-index';
import {
  getAdjustmentIndexByIdData,
  listAdjustmentIndexesData,
  listAdjustmentIndexOptionsData,
} from '@/server/queries/adjustment-index';

/**
 * Server Actions dos Índices de Reajuste (Etapa 4).
 * Guarda: `withTenant`. Camada: server.
 */

export async function listAdjustmentIndexesAction(
  raw: Record<string, unknown> = {},
): Promise<ActionResult<PaginatedAdjustmentIndexes>> {
  return runAction(() => listAdjustmentIndexesData(raw));
}

export async function getAdjustmentIndexByIdAction(
  id: string,
): Promise<ActionResult<AdjustmentIndex | null>> {
  return runAction(() => getAdjustmentIndexByIdData(id));
}

export async function listAdjustmentIndexOptionsAction(): Promise<
  ActionResult<Array<{ label: string; value: string }>>
> {
  return runAction(() => listAdjustmentIndexOptionsData());
}

export async function createAdjustmentIndexAction(
  input: Record<string, unknown>,
): Promise<ActionResult<AdjustmentIndex>> {
  return runAction(async () => {
    const data = createAdjustmentIndexSchema.parse(input);
    return withTenant(() => adjustmentIndexUseCases.create.execute(data));
  });
}

export async function updateAdjustmentIndexAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<AdjustmentIndex>> {
  return runAction(async () => {
    const data = updateAdjustmentIndexSchema.parse(input);
    return withTenant(() => adjustmentIndexUseCases.update.execute(id, data));
  });
}

export async function deleteAdjustmentIndexAction(id: string): Promise<ActionResult<AdjustmentIndex>> {
  return runAction(() => withTenant(() => adjustmentIndexUseCases.remove.execute(id)));
}

/** Valor mensal digitado na tela (ou corrigido à mão). */
export async function upsertAdjustmentIndexValueAction(
  input: Record<string, unknown>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const data = upsertAdjustmentIndexValueSchema.parse(input);
    await withTenant(() => adjustmentIndexUseCases.upsertValue.execute(data));
    return null;
  });
}

export async function deleteAdjustmentIndexValueAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await withTenant(() => adjustmentIndexUseCases.deleteValue.execute(id));
    return null;
  });
}

/** Botão "Atualizar pelo Banco Central" da tela de índices. */
export async function syncAdjustmentIndexesAction(
  input: Record<string, unknown> = {},
): Promise<ActionResult<SyncResult>> {
  return runAction(async () => {
    const { months } = syncAdjustmentIndexesSchema.parse(input);
    return withTenant(() => adjustmentIndexUseCases.sync.execute({ months }));
  });
}
