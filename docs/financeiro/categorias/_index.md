# Categorias e subcategorias

Categorias e subcategorias de receita e despesa usadas em lançamentos, planejamento, relatórios e IPTU, com a Finalidade da Classificação no DFC.

| Aspecto | Detalhe |
|---|---|
| Menu | Financeiro > Categorias/Subcategorias |
| Rota | `/dashboard/categorias` |
| Permissão | recurso `financial-categories` (ver, criar, editar, excluir) |
| Modelos Prisma | `Category`, `Subcategory` |
| Server | `server/actions/financial-category.ts`, `server/actions/financial-subcategory.ts`, `server/queries/financial-category.ts`, `server/queries/financial-subcategory.ts` |
| Domínio | `core/use-cases/financial-category/crud.ts`, `core/use-cases/financial-subcategory/crud.ts`, `core/entities/category.ts`, `core/entities/subcategory.ts` |
| Infra | `infra/repositories/prisma-financial-categories-repository.ts`, `infra/repositories/prisma-financial-subcategories-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Categoria de sistema não pode ser alterada ou excluída (`ForbiddenError`). Excluir categoria com lançamentos ou subcategorias é recusado (`ConflictError`); subcategoria com lançamentos idem. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
2. **Finalidade da Classificação no DFC** (`DfcGroup`): Impostos, Despesas Variáveis, Despesas Fixas ou Pessoal define onde as despesas da categoria entram no Demonstrativo. Não classificada = o sistema tenta reconhecer pelo nome; se não conseguir, entra em "Despesas sem classificação". Mudar a classificação muda distribuição e subtotais do relatório, nunca valores ou saldo final.
3. Subcategoria exige categoria pai existente (404 se não encontrada).
4. Na consolidação de empresas, categorias são unidas por nome e tipo; subcategorias também pelo nome e tipo da categoria pai.
5. Cadastro rápido de categoria/subcategoria (`quickCreate...Action`) nos formulários de lançamento.
