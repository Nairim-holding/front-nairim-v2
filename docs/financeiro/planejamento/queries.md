# Planejamento e controle — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getPlanningDashboardData(raw: Record<string, unknown>,)` | PlanningDashboardResponse | planning:view | planningDashboardQuerySchema |  |
