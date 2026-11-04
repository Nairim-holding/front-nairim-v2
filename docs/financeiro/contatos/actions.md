# Contatos (fornecedores) — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createFinancialSupplierAction(input: Record<string, unknown>)` | Supplier | financial-suppliers:create | createFinancialSupplierSchema |  |
| `updateFinancialSupplierAction(id: string, input: Record<string, unknown>)` | Supplier | financial-suppliers:edit | updateFinancialSupplierSchema |  |
| `deleteFinancialSupplierAction(id: string)` | null | financial-suppliers:delete | — |  |
| `restoreFinancialSupplierAction(id: string)` | Supplier | financial-suppliers:edit | — |  |
| `quickCreateFinancialSupplierAction(input: Record<string, unknown>)` | Supplier | financial-suppliers:create | quickCreateFinancialSupplierSchema |  |
| `listSuppliersAction(raw: Record<string, unknown>)` | PaginatedSuppliers | herdada da query | — |  |
| `getSupplierByIdAction(id: string)` | Supplier | herdada da query | — |  |
| `getSupplierFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
