# Lançamentos

Lançamentos financeiros (receitas, despesas, transferências, parcelamentos e recorrências), anexos, conciliação de créditos de locação e feriados.

| Aspecto | Detalhe |
|---|---|
| Menu | Financeiro > Lançamentos |
| Rota | `/dashboard/lancamentos` |
| Permissão | recurso `financial-transactions` (ver, criar, editar, excluir) |
| Modelos Prisma | `Transaction`, `RecurringConfig`, `Holiday` |
| Server | `server/actions/financial-transaction.ts`, `server/actions/quick-record.ts`, `server/actions/holiday.ts`, `server/queries/financial-transaction.ts` |
| Domínio | `core/use-cases/financial-transaction/attachments.ts`, `core/use-cases/financial-transaction/crud.ts`, `core/use-cases/financial-transaction/lease-credit-reconciliation.ts`, `core/entities/financial-transaction.ts`, `core/entities/statement-order.ts`, `core/entities/holidays.ts` |
| Infra | `infra/repositories/prisma-financial-transactions-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Campos obrigatórios: data do evento, data de efetivação, valor numérico, categoria e instituição financeira. Status: `PENDING` ou `COMPLETED`. Regime Caixa usa `effective_date`, Competência usa `event_date`.
2. **Transferência** exige instituição de origem e de destino diferentes, centro de receita de destino e valor maior que zero; é marcada `is_transfer` e fica fora de receitas/despesas dos relatórios.
3. **Parcelamento** e **recorrência** geram séries (`createInstallmentsAction`, `createRecurrenceAction`); editar com `propagate_fields` propaga campos escolhidos pela série.
4. Anexos: PDF, JPG ou PNG, até um limite por lançamento (`MAX_TRANSACTION_ATTACHMENTS`).
5. **Ordem do extrato**: a migration `20261025000000_transaction_statement_order` cria `Transaction.statement_order` (sequência + trigger). O banco atribui a ordem ao inserir como concluído ou ao mudar Pendente → Concluído (inclusive lote, fatura e conciliação); editar valor preserva; reabrir e concluir atribui nova posição. Empate de data: sequência, criação, ID. Lançamentos anteriores ficam sem sequência (vêm primeiro na mesma data).
6. Novo lançamento que repete parcela gerada da mesma natureza e competência é recusado; restaurar parcela substituída não pode duplicar a substituta ativa.
7. Conciliação de crédito de locação (`searchLeaseCreditCandidatesAction`, `completeLeaseCreditReconciliationAction`) inclui o condomínio no líquido e na quitação dos repasses.
8. Feriados (`Holiday`, escopo por estado) alimentam dias úteis dos alertas de atraso. Cadastro rápido de categoria, subcategoria, centro, cartão, contato.
