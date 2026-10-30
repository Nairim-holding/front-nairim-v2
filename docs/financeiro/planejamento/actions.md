# Planejamento e controle — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `upsertPlanningAction(input: Record<string, unknown>,)` | Planning | planning:edit | planningUpsertSchema |  |
| `deletePlanningAction(id: string)` | null | planning:delete | — |  |
| `getPlanningDashboardAction(raw: Record<string, unknown>,)` | PlanningDashboardResponse | herdada da query | — |  |
