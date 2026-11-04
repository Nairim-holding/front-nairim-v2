# Instituições financeiras — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### FinancialInstitution
- Campos: name: String; is_active: Boolean; account_number: String?; agency_number: String?; bank_number: String?
- Relações: recurring_configs[] → RecurringConfig; transactions[] → Transaction; leases[] → Lease; investments[] → Investment; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`FinancialInstitution`, `CreateFinancialInstitutionData`, `UpdateFinancialInstitutionData`, `ListFinancialInstitutionsParams`, `PaginatedFinancialInstitutions`, `BalanceSummaryItem`

## Validação (Zod, `src/shared/validators`)
- createFinancialInstitutionSchema: name, bank_number, agency_number, account_number, is_active? — financial-institution.ts
- updateFinancialInstitutionSchema: name?, bank_number, agency_number, account_number, is_active? — financial-institution.ts
- listFinancialInstitutionsQuerySchema: limit?, page?, search?, includeInactive? — financial-institution.ts
- quickCreateFinancialInstitutionSchema: name — financial-institution.ts

## Regras de negócio
- Excluir uma instituição com lançamentos relacionados é recusado (`ConflictError`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- O saldo por conta (`getFinancialInstitutionBalanceSummaryAction`) alimenta o widget Saldo por Conta do Resumo e o extrato.
- Instituição também é referenciada por locações, recorrências e investimentos.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Instituição não encontrada | crud.ts |
| ValidationError | Nome da instituição é obrigatório | crud.ts |
| ValidationError | Nome da instituição não pode ser vazio | crud.ts |
| ValidationError | Instituição não está excluída | crud.ts |
| ValidationError | Nome é obrigatório | crud.ts |
