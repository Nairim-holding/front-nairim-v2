# Contatos (fornecedores) — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listFinancialSuppliersData(raw: Record<string, unknown>)` | PaginatedSuppliers | financial-suppliers:view | listFinancialSuppliersQuerySchema |  |
| `getSupplierByIdData(id: string)` | Supplier | financial-suppliers:view | — |  |
| `getSupplierFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | financial-suppliers:view | — |  |
