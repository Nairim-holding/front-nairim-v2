# Auditoria de IPTU — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### IptuAuditSettings
- Campos: income_category_id: String?; income_subcategory_id: String?; expense_category_id: String?; expense_subcategory_id: String?
- Relações: company → Company; income_category → Category; income_subcategory → Subcategory; expense_category → Category; expense_subcategory → Subcategory
- Padrão: id, company_id, created_at, updated_at

### PropertyIptu
- Campos: property_id: String; year: Int; property_tax: Decimal?; property_tax_cash: Decimal?; property_tax_cash_due_date: DateTime?; property_tax_first_installment: Decimal?; property_tax_first_installment_due_date: DateTime?; property_tax_second_installment: Decimal?; property_tax_second_installment_due_date: DateTime?; iptu_installments_count: Int?; iptu_installments: Json?; payment_condition: PaymentCondition?
- Relações: property → Property
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`IptuAuditSettings`, `IptuAuditSettingsInput`, `IptuAuditParams`, `IptuAuditTransactionDetail`, `IptuAuditRow`, `IptuAuditPeriodPoint`, `IptuAuditPropertyOption`, `IptuAuditReport`

## Validação (Zod, `src/shared/validators`)
- iptuAuditSettingsSchema: income_category_id, income_subcategory_id, expense_category_id, expense_subcategory_id — iptu-audit.ts
- iptuAuditQuerySchema — iptu-audit.ts

## Regras de negócio
- Configuração (`IptuAuditSettings`) define categoria e subcategoria de restituição e pagamento por empresa; relatório usa lançamentos concluídos.
- Detalhes por imóvel mostram o tipo do imóvel depois do nome. O comparativo mensal/anual agrupa lançamentos por período com data, imóvel, tipo, inquilino e contrato (quando vinculados), descrição, restituição, pagamento e saldo.
- Pagamentos manuais sem locação continuam, identificados como "sem inquilino vinculado".
- Recurso de permissão `financial-audit` (mesmo do ROI).
