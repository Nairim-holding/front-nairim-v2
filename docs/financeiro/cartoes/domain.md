# Cartões de crédito — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Card
- Campos: name: String; limit: Decimal; is_active: Boolean; closing_day: Int?; due_day: Int?; brand: String; current_balance: Decimal
- Relações: recurring_configs[] → RecurringConfig; transactions[] → Transaction; invoices[] → Invoice; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### Invoice
- Campos: card_id: String; month: Int; year: Int; total_amount: Decimal; status: TransactionStatus; closing_date: DateTime?; due_date: DateTime?; paid_date: DateTime?; paid_amount: Decimal; institution_id: String?
- Relações: transactions[] → Transaction; card → Card; company → Company
- Únicos compostos: card_id, month, year
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`Card`, `CreateCardData`, `UpdateCardData`, `ListCardsParams`, `PaginatedCards`, `CardUsageItem`, `CardUsageFilters`, `InvoiceStatus`, `InvoiceCard`, `InvoiceTransaction`, `Invoice`, `InvoiceWithCard`, `InvoiceWithRelations`, `InvoiceByCardItem`, `CreateInvoiceData`, `UpdateInvoiceStatusData`, `GetInvoiceParams`, `UpdateInvoiceStatusResult`, `DashboardCard`, `DashboardCardTransaction`, `CreditCardDashboard`, `buildCreditCardDashboard`

## Validação (Zod, `src/shared/validators`)
- createFinancialCardSchema: name, limit, closing_day, due_day, is_active? — financial-card.ts
- updateFinancialCardSchema: name?, limit, closing_day, due_day, is_active? — financial-card.ts
- listFinancialCardsQuerySchema: limit?, page?, search?, includeInactive? — financial-card.ts
- quickCreateFinancialCardSchema: name — financial-card.ts
- cardUsageSummarySchema — financial-card.ts
- getInvoiceQuerySchema: cardId, month, year — financial-invoice.ts
- createInvoiceSchema: card_id, month, year, closing_date?, due_date? — financial-invoice.ts
- updateInvoiceStatusSchema: status, effective_date?, paid_amount, institution_id — financial-invoice.ts
- getInvoicesByCardSchema: cardId, year — financial-invoice.ts

## Regras de negócio
- Cartão: nome obrigatório, limite numérico, dia de fechamento e de vencimento entre 1 e 31. Excluir cartão com lançamentos é recusado. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- Fatura duplicada (cartão+mês+ano) é recusada; fatura já concluída não pode ser concluída de novo.
- **Painel**: seleção inicial usa cartões ativos (inativos podem ser incluídos); limpar seleção esvazia gráficos e lançamentos. Fatura vinculada define mês/ano; sem vínculo usa a data efetiva; a compra aparece pela data do evento.
- Entram despesas não excluídas, não canceladas e que não sejam transferência; pagas e pendentes compõem o gasto; pagamentos não contam como compra.
- Limite disponível no mês = limite cadastrado − pendências da competência (não é o limite global do emissor).
- A consulta exige `financial-cards:view` e restringe cartões, categorias, faturas e transações à empresa da sessão; IDs de outra empresa são rejeitados. Ler o painel não cria faturas nem altera lançamentos.
- Cadastro, edição e exclusão ficam em **Gerenciar cartões**, respeitando permissões; ao fechar, o painel recarrega e volta à seleção de ativos.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Cartão não encontrado | crud.ts |
| ValidationError | O nome do cartão é obrigatório | crud.ts |
| ValidationError | O limite deve ser um valor numérico | crud.ts |
| ValidationError | O dia de fechamento deve ser entre 1 e 31 | crud.ts |
| ValidationError | O dia de vencimento deve ser entre 1 e 31 | crud.ts |
| ValidationError | O nome do cartão não pode ser vazio | crud.ts |
| ValidationError | Cartão não está excluído | crud.ts |
| ValidationError | Nome é obrigatório | crud.ts |
| ValidationError | startDate e endDate são obrigatórios | crud.ts |
| ValidationError | cardId é obrigatório | crud.ts |
| ValidationError | Mês inválido. Deve ser entre 1 e 12 | crud.ts |
| ValidationError | Ano inválido | crud.ts |
| ValidationError | card_id é obrigatório | crud.ts |
| ValidationError | Status inválido. Use: PENDING ou COMPLETED | crud.ts |
| ValidationError | Data de Efetivação inválida. Use o formato YYYY-MM-DD | crud.ts |
| ValidationError | O valor pago deve ser numérico | crud.ts |
