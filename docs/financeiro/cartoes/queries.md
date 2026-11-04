# Cartões de crédito — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listFinancialCardsData(raw: Record<string, unknown>)` | PaginatedCards | financial-cards:view | listFinancialCardsQuerySchema |  |
| `getCardByIdData(id: string)` | Card | financial-cards:view | — |  |
| `getCardFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | financial-cards:view | — |  |
| `getCardUsageSummaryData(startDate: Date, endDate: Date, filters: CardUsageFilters,)` | CardUsageItem[] | financial-cards:view | — |  |
| `getInvoiceByCardAndMonthData(cardId: string, month: number, year: number,)` | InvoiceWithRelations / null | financial-transactions:view | — |  |
| `getInvoiceTransactionsData(invoiceId: string)` | InvoiceTransaction[] | financial-transactions:view | — |  |
| `getInvoicesByCardData(cardId: string, year?: number)` | InvoiceByCardItem[] | financial-transactions:view | — |  |
| `getCreditCardDashboardData(input: Record<string, unknown>)` | — | financial-cards:view | creditCardDashboardSchema |  |
