# Tipo de imóvel — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createPropertyTypeAction(input: Record<string, unknown>)` | PropertyType | property-types:create | createPropertyTypeSchema |  |
| `updatePropertyTypeAction(id: string, input: Record<string, unknown>)` | PropertyType | property-types:edit | updatePropertyTypeSchema |  |
| `deletePropertyTypeAction(id: string)` | PropertyType | property-types:delete | — |  |
| `restorePropertyTypeAction(id: string)` | PropertyType | property-types:edit | — |  |
| `listPropertyTypesAction(raw: Record<string, unknown>)` | PaginatedPropertyTypes | herdada da query | — |  |
| `getPropertyTypeByIdAction(id: string)` | PropertyType | herdada da query | — |  |
| `getPropertyTypeFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
