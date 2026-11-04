# Auditoria de IPTU — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `saveIptuAuditSettingsAction(input: Record<string, unknown>)` | IptuAuditSettings | financial-audit:edit | iptuAuditSettingsSchema |  |
| `getIptuAuditSettingsAction()` | IptuAuditSettings / null | herdada da query | — |  |
| `getIptuAuditAction(raw: Record<string, unknown>)` | IptuAuditReport | herdada da query | — |  |
