# Índices de reajuste — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listAdjustmentIndexesData(raw: Record<string, unknown>,)` | PaginatedAdjustmentIndexes | adjustment-indexes:view | listAdjustmentIndexesQuerySchema |  |
| `getAdjustmentIndexByIdData(id: string)` | AdjustmentIndex / null | adjustment-indexes:view | — |  |
| `listAdjustmentIndexOptionsData()` | Array<{ label: string; value: string }> | adjustment-indexes:view | — | Opções do ComboBox "Índice de Reajuste" da aba Valores da Locação. |
