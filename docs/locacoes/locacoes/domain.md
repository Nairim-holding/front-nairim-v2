# Locações — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Lease
- Campos: property_id: String; type_id: String; owner_id: String; tenant_id: String; agency_id: String?; financial_institution_id: String?; contract_number: String; start_date: DateTime; end_date: DateTime; rent_amount: Decimal; condo_fee: Decimal?; property_tax: Decimal?; extra_charges: Decimal?; discount_amount: Decimal?; commission_amount: Decimal?; agency_commission: Decimal?; rent_due_day: Int; tax_due_day: Int?; condo_due_day: Int?; canceled_at: DateTime?; cancellation_justification: String?; cancellation_penalty: Decimal?; other_cancellation_amounts: Decimal?; status: LeaseStatus; payment_condition: PaymentCondition?; property_tax_cash: Decimal?; property_tax_cash_due_date: DateTime?; property_tax_first_installment: Decimal?; property_tax_first_installment_due_date: DateTime?; property_tax_second_installment: Decimal?; property_tax_second_installment_due_date: DateTime?; iptu_year: Int?; iptu_installments: Json?; iptu_installments_due_dates: Json?; iptu_installments_count: Int?; insurance_company: String?; insurance_type: String?; insurance_policy: String?; guarantors: Json?; adjustment_index_id: String?; overdue_status: LeaseOverdueStatus?
- Relações: owner → Owner; property → Property; tenant → Tenant; type → PropertyType; agency → Agency; financial_institution → FinancialInstitution; adjustment_index → AdjustmentIndex; expiry_reminders[] → LeaseExpiryReminder; notifications[] → LeaseNotification; transactions[] → Transaction; documents[] → Document; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### LeaseExpiryReminder
- Campos: user_id: String; lease_id: String; end_date: DateTime; shown_days: String[]; acknowledged_on: String?; dismissed: Boolean
- Relações: company → Company; user → User; lease → Lease
- Únicos compostos: user_id, lease_id, end_date
- Padrão: id, company_id

## Entidades e tipos (`src/core/entities`)
`IptuInstallmentInput`, `Guarantor`, `Lease`, `CreateLeaseData`, `UpdateLeaseData`, `ListLeasesParams`, `PaginatedLeases`, `CancellationChargeInput`, `CancelLeaseInput`, `CancellationPreview`, `CancelLeaseResult`, `LeaseScheduleItem`, `SyncLeaseTransactionsResult`, `LeaseExpiryAlert`, `expiryDays`, `canDismissExpiry`, `LeaseHistorySituation`, `LeaseHistoryRow`, `LeaseHistoryCandidate`, `LeaseHistoryTotal`, `LeaseFinancialHistory`, `LeaseHistorySource`, `leaseHistorySituation`, `leaseHistorySituationLabel`, `installmentLabel`, `summarizeLeaseHistory`, `leaseMonthlyTransactionKind`

## Validação (Zod, `src/shared/validators`)
- createLeaseSchema: property_id, type_id, owner_id, tenant_id, agency_id, financial_institution_id, adjustment_index_id, contract_number, start_date, end_date, rent_amount?, condo_fee, property_tax, extra_charges, discount_amount, commission_amount, rent_due_day, tax_due_day, condo_due_day, status?, payment_condition, property_tax_cash, property_tax_cash_due_date, property_tax_first_installment, property_tax_first_installment_due_date, property_tax_second_installment, property_tax_second_installment_due_date, iptu_year, iptu_installments, iptu_installments_due_dates, iptu_installments_count, insurance_company, insurance_type, insurance_policy, guarantors, cancellation_justification, cancellation_penalty — lease.ts
- updateLeaseSchema: limit?, page?, search? — lease.ts
- listLeasesQuerySchema: limit?, page?, search? — lease.ts

## Regras de negócio
- Número de contrato é único por empresa. Antes de salvar o servidor confere os vínculos financeiros do imóvel (6 campos) e da imobiliária (categoria, subcategoria, % comissão), com mensagem orientando onde corrigir (`lease-financial-setup`).
- A geração mensal cria aluguel e, se informado na locação, **condomínio** (no dia de vencimento próprio ou do aluguel), usando categoria e centro de receita do imóvel. O condomínio gerado não conta como aluguel no ROI. A sincronização preserva parcelas quitadas, lançamentos avulsos e condomínio avulso.
- Cancelar encerra as pendências futuras; dívidas anteriores ao cancelamento continuam visíveis ("Pendência anterior ao cancelamento"). Lançamentos formalmente cancelados não podem ser restaurados. Prévia em `getCancellationPreviewAction`.
- Contrato vigente até o fim do dia final (fuso São Paulo); depois, o imóvel é liberado se não houver outra locação não cancelada vigente. Troca de imóvel recalcula os dois.
- **Histórico Financeiro** reúne lançamentos vinculados, cancelados sem recebimento e candidatos antigos que podem ser vinculados (`linkTransactionsToLeaseAction`); cabeçalho e títulos ficam fixos na rolagem; despesas concluídas em vermelho, receitas em verde; tipo mostra "Receita/Despesa Recorrente".
- Alertas de vencimento (`getLeaseExpiryAlertsAction`) mostram imóvel, inquilino, vencimento, índice de reajuste e dias restantes; `acknowledgeLeaseExpiryAction` registra a ciência (`LeaseExpiryReminder`).
- Exclusão definitiva só por `permanentlyDeleteLeaseAction`; a exclusão comum é lógica.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | cancellation.ts |
| ValidationError | A data do cancelamento é obrigatória | cancellation.ts |
| NotFoundError | Locação não encontrada | cancellation.ts |
| ValidationError | É necessário selecionar uma categoria no imóvel antes de criar a locação. | crud.ts |
| ConflictError | Este número de contrato já está registrado | crud.ts |
| ConflictError | Número de contrato já registrado para outra locação | crud.ts |
