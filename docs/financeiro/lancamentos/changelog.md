# Lançamentos — Histórico

Atualize aqui a cada alteração no módulo. Mais recente primeiro.

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
