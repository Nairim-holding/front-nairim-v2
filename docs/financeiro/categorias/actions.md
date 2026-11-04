# Categorias e subcategorias — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createFinancialCategoryAction(input: Record<string, unknown>)` | Category | financial-categories:create | createFinancialCategorySchema |  |
| `updateFinancialCategoryAction(id: string, input: Record<string, unknown>)` | Category | financial-categories:edit | updateFinancialCategorySchema |  |
| `deleteFinancialCategoryAction(id: string)` | null | financial-categories:delete | — |  |
| `restoreFinancialCategoryAction(id: string)` | Category | financial-categories:edit | — |  |
| `quickCreateFinancialCategoryAction(input: Record<string, unknown>)` | Category | financial-categories:create | quickCreateFinancialCategorySchema |  |
| `listCategoriesAction(raw: Record<string, unknown>)` | PaginatedCategories | herdada da query | — |  |
| `getCategoryByIdAction(id: string)` | Category | herdada da query | — |  |
| `getCategoryFiltersAction()` | Record<string, unknown> | herdada da query | — |  |
| `createFinancialSubcategoryAction(input: Record<string, unknown>)` | Subcategory | financial-categories:create | createFinancialSubcategorySchema |  |
| `updateFinancialSubcategoryAction(id: string, input: Record<string, unknown>)` | Subcategory | financial-categories:edit | updateFinancialSubcategorySchema |  |
| `deleteFinancialSubcategoryAction(id: string)` | null | financial-categories:delete | — |  |
| `restoreFinancialSubcategoryAction(id: string)` | Subcategory | financial-categories:edit | — |  |
| `quickCreateFinancialSubcategoryAction(input: Record<string, unknown>)` | Subcategory | financial-categories:create | quickCreateFinancialSubcategorySchema |  |
| `listSubcategoriesAction(raw: Record<string, unknown>)` | PaginatedSubcategories | herdada da query | — |  |
| `getSubcategoryByIdAction(id: string)` | Subcategory | herdada da query | — |  |
| `getSubcategoryFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
