# Lançamentos — Telas

## `/dashboard/lancamentos` — Identificar crédito de locação
Arquivo: `src/app/dashboard/(financeiro)/lancamentos/page.tsx`
- Colunas da lista: Data Evento, Data Efetiva, Categoria, Subcat., Instituição, Cartão, Centro, Contato, Descrição, Valor, Status, Ação
- Outros rótulos: Identificar crédito
- A confirmação do crédito atualiza a tabela com o período, filtros, pesquisa, aba, ordenação e paginação já selecionados.
- Ao colar a descrição de um aluguel com contrato em uma receita avulsa, **Marcar como crédito a maior** acrescenta “Entrada a maior” à descrição antes de salvar a linha.
- No Resumo, o previsto de cada tipo soma pendentes e concluídos. A diferença entre os dois previstos alimenta o Resumo Previsto e o Previsto Restante. O fechamento soma o saldo das contas ao Previsto Restante.
- Componentes: `layout/PageSection`, `table/InlineEditableTable`, `domain/financial/TransferDestinationModal`, `domain/financial/LeaseCreditReconciliationModal`, `ui/QuickCreateAutocomplete`
