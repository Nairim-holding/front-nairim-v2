# Imóveis — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createUnifiedPropertyAction(formData: FormData)` | Property | properties:create | createUnifiedPropertySchema |  |
| `updateUnifiedPropertyAction(id: string, formData: FormData)` | Property | properties:edit | — |  |
| `deletePropertyAction(id: string)` | Property | properties:delete | — |  |
| `restorePropertyAction(id: string)` | Property | properties:edit | — |  |
| `listPropertiesAction(raw: Record<string, unknown>)` | PaginatedProperties | herdada da query | — |  |
| `getPropertyByIdAction(id: string)` | Property | herdada da query | — |  |
| `getPropertyFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
| `getPropertyCloneCompaniesAction()` | — | properties:create | — |  |
| `clonePropertiesAction(input: Record<string, unknown>)` | — | properties:create, properties:view | — |  |
| `previewPropertyDocumentImportAction(formData: FormData)` | PropertyDocumentPreview | properties:create | — |  |
| `getIptuPropertyFiltersAction(raw?: Record<string, unknown>,)` | IptuPropertyFiltersResult | properties:view | — | Server Action do módulo IPTU do imóvel. Substitui o endpoint GET /iptu-property/filters. |
