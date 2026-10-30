# Instituições financeiras — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listFinancialInstitutionsData(raw: Record<string, unknown>)` | PaginatedFinancialInstitutions | financial-institutions:view | listFinancialInstitutionsQuerySchema |  |
| `getFinancialInstitutionByIdData(id: string)` | FinancialInstitution | financial-institutions:view | — |  |
| `getFinancialInstitutionFiltersData()` | Record<string, unknown> | financial-institutions:view | — |  |
| `getFinancialInstitutionBalanceSummaryData(raw: Record<string, unknown> = {})` | BalanceSummaryItem[] | financial-institutions:view | — |  |
