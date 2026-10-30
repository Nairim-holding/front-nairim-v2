# Vitrine pública de imóveis — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getPublicPropertiesAction(slug: string, raw?: Record<string, unknown>, opts?: { availableOnly?: boolean },)` | PublicPaginated<PublicProperty> | herdada da query | — | Server Actions da vitrine PÚBLICA (para Client Components). Substituem o `fetch` ao `/public/:companySlug/*` do Express — sem toke |
| `getPublicPropertyByIdAction(slug: string, id: string,)` | PublicProperty / null | herdada da query | — |  |
| `getPublicPropertyTypesAction(slug: string, raw?: Record<string, unknown>,)` | PublicPaginated<PublicPropertyType> | herdada da query | — |  |
