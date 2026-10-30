# Locações — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createLeaseAction(input: Record<string, unknown>)` | LeaseWithWarnings | leases:create | createLeaseSchema | Lease + avisos não bloqueantes (regras de negócio/IPTU + financeiro). */ export type LeaseWithWarnings = Lease & { warnings?: stri |
| `updateLeaseAction(id: string, input: Record<string, unknown>)` | LeaseWithWarnings | leases:edit | updateLeaseSchema |  |
| `deleteLeaseAction(id: string)` | Lease | leases:delete | — |  |
| `permanentlyDeleteLeaseAction(id: string)` | Lease | leases:delete | — |  |
| `restoreLeaseAction(id: string)` | Lease | leases:edit | — |  |
| `cancelLeaseAction(id: string, input: CancelLeaseInput)` | CancelLeaseResult | leases:edit | — | Efetiva o cancelamento: soft-delete dos lançamentos confirmados a partir da data, encargo opcional, marca CANCELED e libera o imóv |
| `updateLeaseDocumentsAction(id: string, formData: FormData)` | Lease | leases:edit | — |  |
| `listLeasesAction(raw: Record<string, unknown>)` | PaginatedLeases | herdada da query | — |  |
| `getLeaseByIdAction(id: string)` | Lease | herdada da query | — |  |
| `getLeaseFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
| `getLeaseFinancialHistoryAction(id: string)` | LeaseFinancialHistory | herdada da query | — | Histórico Financeiro do contrato: lançamentos vinculados, cancelados e sem vínculo. |
| `linkTransactionsToLeaseAction(id: string, transactionIds: string[])` | { linked: number } | herdada da query | — | Histórico Financeiro do contrato: lançamentos vinculados, cancelados e sem vínculo. */ export async function getLeaseFinancialHist |
| `getCancellationPreviewAction(id: string, date: string)` | CancellationPreview | herdada da query | — | Vincula ao contrato lançamentos sugeridos pelo Histórico Financeiro. */ export async function linkTransactionsToLeaseAction(id: st |
| `getLeaseExpiryAlertsAction(displayedIds: string[] = [])` | — | leases:view | — |  |
| `acknowledgeLeaseExpiryAction(leaseId: string, endDate: string, dismiss = false)` | — | leases:view | — |  |
