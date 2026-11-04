# Lançamentos — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getFinancialChartDetailsAction(query: FinancialChartDetailQuery, filters?: Record<string, unknown>,)` | FinancialChartDetailRow[] | herdada da query | — |  |
| `createFinancialTransactionAction(input: Record<string, unknown>,)` | Transaction | financial-transactions:create | createFinancialTransactionSchema |  |
| `updateFinancialTransactionAction(id: string, input: Record<string, unknown>,)` | Transaction | financial-transactions:edit | updateFinancialTransactionSchema |  |
| `deleteFinancialTransactionAction(id: string)` | null | financial-transactions:delete | — |  |
| `restoreFinancialTransactionAction(id: string)` | Transaction | financial-transactions:edit | — |  |
| `createTransferAction(input: Record<string, unknown>)` | TransferResult | financial-transactions:create | createTransferSchema |  |
| `createInstallmentsAction(input: Record<string, unknown>,)` | InstallmentsResult | financial-transactions:create | createInstallmentsSchema |  |
| `createRecurrenceAction(input: Record<string, unknown>,)` | RecurrenceResult | financial-transactions:create | createRecurrenceSchema |  |
| `listFinancialTransactionsAction(raw: Record<string, unknown>,)` | PaginatedTransactions | herdada da query | — |  |
| `getTransactionByIdAction(id: string)` | Transaction | herdada da query | — |  |
| `getTransactionFiltersAction(raw: Record<string, unknown>,)` | TransactionFiltersResult | herdada da query | — |  |
| `getRelatedTransactionsAction(id: string)` | RelatedTransactionsResult | herdada da query | — |  |
| `searchLeaseCreditCandidatesAction(raw: Record<string, unknown>,)` | CreditCandidate[] | financial-transactions:view | creditReconciliationSearchSchema |  |
| `completeLeaseCreditReconciliationAction(raw: Record<string, unknown>,)` | CompleteCreditReconciliationResult | financial-transactions:edit | completeCreditReconciliationSchema |  |
| `getMonthlySummaryAction(raw: Record<string, unknown>,)` | MonthlySummary | herdada da query | — |  |
| `getMonthlySummaryMultiAction(raw: Record<string, unknown>,)` | MonthlySummaryMultiResult | herdada da query | — |  |
| `getAvailableYearsAction(raw: Record<string, unknown> = {})` | AvailableYearsResult | herdada da query | — |  |
| `getExpenseByCategoryAction(raw: Record<string, unknown>,)` | ExpenseByCategoryResult | herdada da query | — |  |
| `getSubcategoryBreakdownAction(raw: Record<string, unknown>,)` | SubcategoryBreakdownResult | herdada da query | — |  |
| `getTransactionDocumentsAction(transactionId: string,)` | TransactionDocument[] | herdada da query | — |  |
| `uploadTransactionDocumentsAction(transactionId: string, formData: FormData,)` | TransactionDocument[] | financial-transactions:edit, financial-transactions:edit | — | Envia anexos (multipart) do lançamento. Contrato do POST /financial-transaction/:id/documents: arquivos no campo `attachments`. |
| `deleteTransactionDocumentAction(transactionId: string, documentId: string,)` | null | financial-transactions:delete | — | Exclui um anexo do lançamento. DELETE /financial-transaction/:id/documents/:documentId. |
| `quickCreateRecordAction(resource: 'owners' / 'tenants' / 'agencies' / 'property-types', rawName: string)` | — | herdada da query | — |  |
| `listHolidaysAction(raw: Record<string, unknown>)` | HolidayItem[] | financial-transactions:view | listHolidaysSchema |  |
| `createHolidayAction(raw: Record<string, unknown>)` | HolidayItem | financial-transactions:edit | createHolidaySchema |  |
| `deleteHolidayAction(id: string)` | null | financial-transactions:edit | — |  |
