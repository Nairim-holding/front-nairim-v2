# Empresas — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getMyBrandingAction()` | — | sessão | — | Lê o branding da PRÓPRIA empresa (para Client Components que carregam o form). Leitura exposta como action porque Client Component |
| `updateBrandingAction(input: Record<string, unknown>)` | — | sessão (admin) | — |  |
| `uploadOwnBrandingAssetAction(formData: FormData, field: BrandingAssetField,)` | — | sessão (admin) | — |  |
| `uploadCompanyBrandingAssetAction(companyId: string, formData: FormData, field: BrandingAssetField,)` | — | herdada da query | — |  |
| `switchCompanyAction(slug: string)` | — | herdada da query | switchCompanySchema |  |
| `checkSlugAction(slug: string)` | — | herdada da query | — |  |
| `getCompanyByIdAction(id: string)` | — | herdada da query | — |  |
| `createCompanyAction(input: Record<string, unknown>)` | — | herdada da query | — |  |
| `updateCompanyAction(id: string, input: Record<string, unknown>)` | — | herdada da query | — |  |
| `deleteCompanyAction(id: string)` | — | herdada da query | — |  |
| `restoreCompanyAction(id: string)` | — | herdada da query | — |  |
| `listCompaniesAction(raw: Record<string, unknown>)` | — | herdada da query | — |  |
| `getCompanyFiltersAction(_raw?: Record<string, unknown>)` | — | herdada da query | — |  |
| `listAccessibleCompaniesAction()` | — | herdada da query | — |  |
