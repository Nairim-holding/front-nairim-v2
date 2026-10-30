# Categorias e subcategorias — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Category
- Campos: name: String; type: TransactionType; is_active: Boolean; is_system: Boolean; dfc_group: DfcGroup?
- Relações: recurring_configs[] → RecurringConfig; subcategories[] → Subcategory; transactions[] → Transaction; plannings[] → Planning; properties[] → Property; iptu_refund_properties[] → Property; commission_agencies[] → Agency; company → Company; iptu_audit_income_settings[] → IptuAuditSettings; iptu_audit_expense_settings[] → IptuAuditSettings
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### Subcategory
- Campos: category_id: String; name: String; is_active: Boolean
- Relações: recurring_configs[] → RecurringConfig; category → Category; transactions[] → Transaction; plannings[] → Planning; properties[] → Property; iptu_refund_properties[] → Property; commission_agencies[] → Agency; company → Company; iptu_audit_income_settings[] → IptuAuditSettings; iptu_audit_expense_settings[] → IptuAuditSettings
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`TRANSACTION_TYPES`, `TransactionType`, `DFC_GROUPS`, `DfcGroup`, `Category`, `CreateCategoryData`, `UpdateCategoryData`, `ListCategoriesParams`, `PaginatedCategories`, `Subcategory`, `CreateSubcategoryData`, `UpdateSubcategoryData`, `ListSubcategoriesParams`, `PaginatedSubcategories`

## Validação (Zod, `src/shared/validators`)
- createFinancialCategorySchema: name, type, is_active?, dfc_group — financial-category.ts
- updateFinancialCategorySchema: name?, type?, is_active?, dfc_group — financial-category.ts
- listFinancialCategoriesQuerySchema: limit?, page?, search?, includeInactive? — financial-category.ts
- quickCreateFinancialCategorySchema: name, type — financial-category.ts
- createFinancialSubcategorySchema: name, category_id, is_active? — financial-subcategory.ts
- updateFinancialSubcategorySchema: name?, category_id?, is_active? — financial-subcategory.ts
- listFinancialSubcategoriesQuerySchema: limit?, page?, search?, includeInactive? — financial-subcategory.ts
- quickCreateFinancialSubcategorySchema: name, category_id — financial-subcategory.ts

## Regras de negócio
- Categoria de sistema não pode ser alterada ou excluída (`ForbiddenError`). Excluir categoria com lançamentos ou subcategorias é recusado (`ConflictError`); subcategoria com lançamentos idem. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- **Finalidade da Classificação no DFC** (`DfcGroup`): Impostos, Despesas Variáveis, Despesas Fixas ou Pessoal define onde as despesas da categoria entram no Demonstrativo. Não classificada = o sistema tenta reconhecer pelo nome; se não conseguir, entra em "Despesas sem classificação". Mudar a classificação muda distribuição e subtotais do relatório, nunca valores ou saldo final.
- Subcategoria exige categoria pai existente (404 se não encontrada).
- Na consolidação de empresas, categorias são unidas por nome e tipo; subcategorias também pelo nome e tipo da categoria pai.
- Cadastro rápido de categoria/subcategoria (`quickCreate...Action`) nos formulários de lançamento.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Categoria não encontrada | crud.ts |
| ValidationError | Nome da categoria é obrigatório | crud.ts |
| ValidationError | Tipo de categoria inválido. Deve ser INCOME ou EXPENSE | crud.ts |
| ValidationError | dfc_group deve ser um dos valores: TAXES, VARIABLE_EXPENSE, FIXED_EXPENSE, PAYROLL | crud.ts |
| ValidationError | O nome da categoria não pode ser vazio | crud.ts |
| ForbiddenError | Não é possível alterar categorias internas do sistema. | crud.ts |
| ValidationError | Categoria não está excluída | crud.ts |
| ValidationError | Nome é obrigatório | crud.ts |
| ValidationError | Tipo inválido | crud.ts |
| NotFoundError | Subcategoria não encontrada | crud.ts |
| ValidationError | Nome da subcategoria é obrigatório | crud.ts |
| ValidationError | O ID da categoria pai é obrigatório | crud.ts |
| NotFoundError | Categoria pai não encontrada | crud.ts |
| ValidationError | O nome da subcategoria não pode ser vazio | crud.ts |
| ValidationError | O ID da categoria pai não pode ser vazio | crud.ts |
| ValidationError | Subcategoria não está excluída | crud.ts |
| ValidationError | Categoria pai é obrigatória | crud.ts |
