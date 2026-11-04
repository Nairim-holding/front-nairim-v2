# Cartões de crédito — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createFinancialCardAction(input: Record<string, unknown>)` | Card | financial-cards:create | createFinancialCardSchema |  |
| `updateFinancialCardAction(id: string, input: Record<string, unknown>)` | Card | financial-cards:edit | updateFinancialCardSchema |  |
| `deleteFinancialCardAction(id: string)` | null | financial-cards:delete | — |  |
| `restoreFinancialCardAction(id: string)` | Card | financial-cards:edit | — |  |
| `quickCreateFinancialCardAction(input: Record<string, unknown>)` | Card | financial-cards:create | quickCreateFinancialCardSchema |  |
| `getCardUsageSummaryAction(input: Record<string, unknown>,)` | CardUsageItem[] | herdada da query | cardUsageSummarySchema |  |
| `listCardsAction(raw: Record<string, unknown>)` | PaginatedCards | herdada da query | — |  |
| `getCardByIdAction(id: string)` | Card | herdada da query | — |  |
| `getCardFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
| `createInvoiceAction(input: Record<string, unknown>)` | InvoiceWithRelations | financial-transactions:create | createInvoiceSchema |  |
| `updateInvoiceStatusAction(id: string, input: Record<string, unknown>,)` | UpdateInvoiceStatusResult | financial-transactions:edit | updateInvoiceStatusSchema |  |
| `getInvoiceAction(raw: Record<string, unknown>,)` | InvoiceWithRelations / null | herdada da query | getInvoiceQuerySchema |  |
| `getInvoiceTransactionsAction(invoiceId: string)` | InvoiceTransaction[] | herdada da query | — |  |
| `getInvoicesByCardAction(raw: Record<string, unknown>,)` | InvoiceByCardItem[] | herdada da query | getInvoicesByCardSchema |  |
| `getCreditCardDashboardAction(input: Record<string, unknown>)` | — | herdada da query | — |  |
