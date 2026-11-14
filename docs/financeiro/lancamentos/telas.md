# Lançamentos — Telas

## `/dashboard/lancamentos` — Identificar crédito de locação
Arquivo: `src/app/dashboard/(financeiro)/lancamentos/page.tsx`
- Colunas da lista: Data Evento, Data Efetiva, Categoria, Subcat., Instituição, Cartão, Centro, Contato, Descrição, Valor, Status, Ação
- Outros rótulos: Identificar crédito
- A confirmação do crédito atualiza a tabela com o período, filtros, pesquisa, aba, ordenação e paginação já selecionados.
- Componentes: `layout/PageSection`, `table/InlineEditableTable`, `domain/financial/TransferDestinationModal`, `domain/financial/LeaseCreditReconciliationModal`, `ui/QuickCreateAutocomplete`
