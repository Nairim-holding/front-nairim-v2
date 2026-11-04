# Lançamentos — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listFinancialTransactionsData(raw: Record<string, unknown>,)` | PaginatedTransactions | financial-transactions:view | listFinancialTransactionsQuerySchema |  |
| `getTransactionByIdData(id: string)` | Transaction | financial-transactions:view | — |  |
| `getTransactionFiltersData(raw: Record<string, unknown>)` | TransactionFiltersResult | financial-transactions:view | — |  |
| `getRelatedTransactionsData(id: string)` | — | financial-transactions:view | — |  |
