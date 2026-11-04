# Índices de reajuste — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listAdjustmentIndexesAction(raw: Record<string, unknown> = {},)` | PaginatedAdjustmentIndexes | herdada da query | — |  |
| `getAdjustmentIndexByIdAction(id: string,)` | AdjustmentIndex / null | herdada da query | — |  |
| `listAdjustmentIndexOptionsAction()` | Array<{ label: string; value: string }> | herdada da query | — |  |
| `createAdjustmentIndexAction(input: Record<string, unknown>,)` | AdjustmentIndex | adjustment-indexes:create | createAdjustmentIndexSchema |  |
| `updateAdjustmentIndexAction(id: string, input: Record<string, unknown>,)` | AdjustmentIndex | adjustment-indexes:edit | updateAdjustmentIndexSchema |  |
| `deleteAdjustmentIndexAction(id: string)` | AdjustmentIndex | adjustment-indexes:delete | — |  |
| `upsertAdjustmentIndexValueAction(input: Record<string, unknown>,)` | null | adjustment-indexes:edit | upsertAdjustmentIndexValueSchema | Valor mensal digitado na tela (ou corrigido à mão). |
| `deleteAdjustmentIndexValueAction(id: string)` | null | adjustment-indexes:delete | — |  |
| `syncAdjustmentIndexesAction(input: Record<string, unknown> = {},)` | SyncResult | adjustment-indexes:edit | syncAdjustmentIndexesSchema | Botão "Atualizar pelo Banco Central" da tela de índices. |
