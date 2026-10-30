# Alertas de atrasos — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getOverdueLeaseAlertsAction()` | LeaseOverdueSummary | herdada da query | — |  |
| `updateLeaseOverdueStatusAction(transactionId: string, status: LeaseOverdueStatus / null,)` | null | leases:edit | — |  |
