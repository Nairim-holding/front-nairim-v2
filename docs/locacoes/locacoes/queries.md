# Locações — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `splitListParams(raw: Record<string, unknown>)` | — | herdada da query | — |  |
| `listLeasesData(raw: Record<string, unknown>)` | PaginatedLeases | leases:view | listLeasesQuerySchema |  |
| `getLeaseByIdData(id: string)` | Lease | leases:view | — |  |
| `getLeaseFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | leases:view | — |  |
| `getCancellationPreviewData(id: string, date: string)` | CancellationPreview | leases:view | — |  |
| `findLeaseHistoryCandidates(lease: { id: string; contract_number: string; property: { title: string } },)` | LeaseHistoryCandidate[] | herdada da query | — | Lançamentos sem `lease_id` que a descrição liga, sem ambiguidade, a este contrato. |
| `getLeaseFinancialHistoryData(leaseId: string)` | LeaseFinancialHistory | leases:view | — |  |
| `linkTransactionsToLeaseData(leaseId: string, transactionIds: string[])` | { linked: number } | leases:edit | — | Amarra à locação lançamentos que estavam sem vínculo. Só aceita os que a própria consulta sugere — o cliente não escolhe IDs arbit |
