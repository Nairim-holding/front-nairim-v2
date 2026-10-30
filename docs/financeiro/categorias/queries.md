# Categorias e subcategorias — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listFinancialCategoriesData(raw: Record<string, unknown>)` | PaginatedCategories | financial-categories:view | listFinancialCategoriesQuerySchema |  |
| `getCategoryByIdData(id: string)` | Category | financial-categories:view | — |  |
| `getCategoryFiltersData()` | Record<string, unknown> | financial-categories:view | — |  |
| `listFinancialSubcategoriesData(raw: Record<string, unknown>)` | PaginatedSubcategories | financial-categories:view | listFinancialSubcategoriesQuerySchema |  |
| `getSubcategoryByIdData(id: string)` | Subcategory | financial-categories:view | — |  |
| `getSubcategoryFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | financial-categories:view | — |  |
