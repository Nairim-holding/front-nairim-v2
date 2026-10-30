# ROI por imóvel — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `saveRoiSettingsAction(input: Record<string, unknown>)` | RoiSettingsView | financial-audit:edit | roiSettingsSchema |  |
| `getRoiSettingsAction()` | RoiSettingsView | herdada da query | — |  |
| `getRoiReportAction(raw: Record<string, unknown>)` | RoiReport | herdada da query | — |  |
| `getRoiOriginAction(raw: Record<string, unknown>)` | RoiOrigin | herdada da query | — |  |
