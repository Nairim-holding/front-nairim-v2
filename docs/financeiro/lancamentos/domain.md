# Lançamentos — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Transaction
- Campos: event_date: DateTime; effective_date: DateTime; purchase_date: DateTime?; description: String; amount: Decimal; status: TransactionStatus; category_id: String; subcategory_id: String?; financial_institution_id: String; card_id: String?; center_id: String?; supplier_id: String?; installment_number: Int?; is_recurring: Boolean; occurrence_number: Int?; parent_transaction_id: String?; payment_mode: PaymentMode?; recurring_frequency: RecurringFrequency?; recurring_group_id: String?; installment_group_id: String?; total_installments: Int?; invoice_id: String?; lease_id: String?; transfer_group_id: String?; is_transfer: Boolean; is_cancellation_charge: Boolean; canceled_at: DateTime?; statement_order: Int?
- Relações: card → Card; category → Category; center → Center; financial_institution → FinancialInstitution; invoice → Invoice; lease → Lease; parent_transaction → Transaction; child_transactions[] → Transaction; recurring_config → RecurringConfig; subcategory → Subcategory; supplier → Supplier; company → Company; documents[] → Document
- Únicos compostos: recurring_group_id, occurrence_number
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### RecurringConfig
- Campos: description: String; amount: Decimal; frequency: RecurringFrequency; category_id: String; subcategory_id: String?; financial_institution_id: String; card_id: String?; center_id: String?; supplier_id: String?; start_date: DateTime; end_date: DateTime?; next_generation_date: DateTime?; is_active: Boolean; total_occurrences: Int?; generated_occurrences: Int
- Relações: card → Card; category → Category; center → Center; financial_institution → FinancialInstitution; subcategory → Subcategory; supplier → Supplier; transactions[] → Transaction; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### Holiday
- Campos: date: DateTime; description: String; scope: HolidayScope; state: String?; city: String?
- Relações: company → Company
- Únicos compostos: company_id, date, description
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`TransactionStatus`, `PaymentMode`, `RecurringFrequency`, `Transaction`, `CreateTransactionData`, `UpdateTransactionData`, `ListTransactionsParams`, `PaginatedTransactions`, `TransactionSummary`, `TransactionTotals`, `TransactionFilterDefinition`, `TransactionFiltersResult`, `CreateTransferData`, `TransferResult`, `CreateInstallmentsData`, `InstallmentRecord`, `InstallmentsResult`, `CreateRecurrenceData`, `RecurrenceResult`, `RelatedTransactionsResult`, `TransactionEntityFilters`, `MonthSummary`, `MonthlySummary`, `MonthlySummaryMultiResult`, `AvailableYearsResult`, `ByYearValue`, `ExpenseByCategoryItem`, `ExpenseByCategoryResult`, `SubcategoryBreakdownItem`, `SubcategoryBreakdownResult`

## Validação (Zod, `src/shared/validators`)
- createFinancialTransactionSchema: event_date, effective_date, description?, amount, status?, category_id, subcategory_id?, financial_institution_id, card_id?, center_id?, supplier_id? — financial-transaction.ts
- updateFinancialTransactionSchema: limit?, page?, search?, includeInactive — financial-transaction.ts
- listFinancialTransactionsQuerySchema: limit?, page?, search?, includeInactive — financial-transaction.ts
- createTransferSchema — financial-transaction.ts
- createInstallmentsSchema — financial-transaction.ts
- createRecurrenceSchema — financial-transaction.ts
- createHolidaySchema: date, description, scope, state, city — holiday.ts
- listHolidaysSchema: year — holiday.ts
- creditReconciliationSearchSchema: credit_date, credited_amount, financial_institution_id, agency_ids — credit-reconciliation.ts
- completeCreditReconciliationSchema — credit-reconciliation.ts

## Regras de negócio
- Campos obrigatórios: data do evento, data de efetivação, valor numérico, categoria e instituição financeira. Status: `PENDING` ou `COMPLETED`. Regime Caixa usa `effective_date`, Competência usa `event_date`.
- **Transferência** exige instituição de origem e de destino diferentes, centro de receita de destino e valor maior que zero; é marcada `is_transfer` e fica fora de receitas/despesas dos relatórios.
- **Parcelamento** e **recorrência** geram séries (`createInstallmentsAction`, `createRecurrenceAction`); editar com `propagate_fields` propaga campos escolhidos pela série.
- Anexos: PDF, JPG ou PNG, até um limite por lançamento (`MAX_TRANSACTION_ATTACHMENTS`).
- **Ordem do extrato**: a migration `20261025000000_transaction_statement_order` cria `Transaction.statement_order` (sequência + trigger). O banco atribui a ordem ao inserir como concluído ou ao mudar Pendente → Concluído (inclusive lote, fatura e conciliação); editar valor preserva; reabrir e concluir atribui nova posição. Empate de data: sequência, criação, ID. Lançamentos anteriores ficam sem sequência (vêm primeiro na mesma data).
- Novo lançamento que repete parcela gerada da mesma natureza e competência é recusado; restaurar parcela substituída não pode duplicar a substituta ativa.
- Conciliação de crédito de locação (`searchLeaseCreditCandidatesAction`, `completeLeaseCreditReconciliationAction`) inclui o condomínio no líquido e na quitação dos repasses.
- Feriados (`Holiday`, escopo por estado) alimentam dias úteis dos alertas de atraso. Cadastro rápido de categoria, subcategoria, centro, cartão, contato.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID do lançamento é obrigatório | attachments.ts |
| NotFoundError | Lançamento não encontrado | attachments.ts |
| ValidationError | Tipo de arquivo não permitido: ${invalid.contentType}. Envie apenas PDF, JPG ou PNG. | attachments.ts |
| ValidationError | Limite de ${MAX_TRANSACTION_ATTACHMENTS} anexos por lançamento excedido (já existem ${existingCount}). | attachments.ts |
| ValidationError | O ID do lançamento e do anexo são obrigatórios | attachments.ts |
| ValidationError | O ID é obrigatório | crud.ts |
| ValidationError | A Data do Evento é obrigatória | crud.ts |
| ValidationError | A Data de Efetivação é obrigatória | crud.ts |
| ValidationError | O Valor deve ser numérico e é obrigatório | crud.ts |
| ValidationError | A Categoria é obrigatória | crud.ts |
| ValidationError | A Instituição Financeira é obrigatória | crud.ts |
| ValidationError | Status inválido. Deve ser PENDING ou COMPLETED | crud.ts |
| ValidationError | O Valor deve ser numérico | crud.ts |
| ValidationError | propagate_fields deve ser uma lista de campos | crud.ts |
| ValidationError | Lançamento não está excluído | crud.ts |
| ValidationError | Instituição de origem é obrigatória. | crud.ts |
| ValidationError | Instituição de destino é obrigatória. | crud.ts |
| ValidationError | Centro de Receita de destino é obrigatório. | crud.ts |
| ValidationError | A conta de destino deve ser diferente da conta de origem. | crud.ts |
| ValidationError | Valor da transferência deve ser maior que zero. | crud.ts |
| ValidationError | O Valor da Parcela deve ser numérico e é obrigatório | crud.ts |
| ValidationError | O Valor da Parcela deve ser maior que zero | crud.ts |
