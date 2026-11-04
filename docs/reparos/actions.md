# Reparos — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listRepairsAction(raw: Record<string, unknown>)` | — | repairs:view | repairListSchema |  |
| `getRepairPropertiesAction()` | — | repairs:view | — |  |
| `saveRepairAction(id: string / null, raw: Record<string, unknown>)` | — | herdada da query | repairSchema |  |
| `deleteRepairAction(id: string)` | — | repairs:delete | — |  |
| `uploadRepairMediaAction(id: string, form: FormData)` | — | repairs:edit | — |  |
| `deleteRepairMediaAction(id: string, mediaId: string)` | — | repairs:delete | — |  |
