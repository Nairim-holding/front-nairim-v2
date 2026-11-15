# Lançamentos — Histórico

Atualize aqui a cada alteração no módulo. Mais recente primeiro.

### 2026-11-15 — Resumo Financeiro e crédito a maior (correções 56)

**Arquivos**  `src/components/domain/financial/SummaryPanel/index.tsx`, `src/components/table/InlineEditableTable/index.tsx` e `src/infra/repositories/prisma-financial-transactions-repository.ts`.

**Razão**  O painel exibia apenas pendências em Previsto, subtraía novamente as baixas e usava esse resultado na previsão de fechamento.

**Impacto**  Previsto soma concluídos e pendentes dentro do período, filtros e pesquisa. A previsão de fechamento soma ao saldo das contas a diferença entre receitas e despesas previstas.

Ao colar a descrição de um aluguel em uma receita avulsa, a tabela oferece **Marcar como crédito a maior**. A opção conserva a descrição do contrato e identifica o crédito como avulso.

### 2026-11-13 — Conciliação e crédito a maior (correções 55)

**Arquivos**  `src/app/dashboard/(financeiro)/lancamentos/page.tsx`, `src/components/table/InlineEditableTable/index.tsx`, `src/hooks/useOptimizedTableData.ts` e `src/core/entities/lease-transaction-kind.ts`.

**Razão**  A confirmação recriava a tabela e zerava os filtros. Informar o contrato na descrição de um crédito a maior podia acionar a validação de parcela duplicada.

**Impacto**  A tabela consulta os dados com a seleção atual após a confirmação. Créditos a maior de aluguel podem ser salvos como lançamentos avulsos vinculados à locação.

### 2026-10-21 — Sequência das baixas (correções 51)
- Migration `20261025000000_transaction_statement_order`; extrato bancário usa a ordem de conclusão; listagem ordenada por data usa o mesmo desempate (invertido no decrescente).

### 2026-10-14 — Duplicidade de parcelas
- Recusa de lançamento que repete parcela gerada; vínculo considera a subcategoria Aluguéis quando a descrição é livre.

### 2026-10-30 — Documentação inicial
- **Arquivos:** esta pasta. **Razão:** economizar leitura de código em futuras sessões.
