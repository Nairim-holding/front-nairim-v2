# Centros — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Center
- Campos: name: String; type: TransactionType; is_active: Boolean
- Relações: recurring_configs[] → RecurringConfig; transactions[] → Transaction; properties[] → Property; debit_properties[] → Property; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`Center`, `CreateCenterData`, `UpdateCenterData`, `ListCentersParams`, `PaginatedCenters`, `CenterSummaryRow`, `buildCenterSummary`

## Validação (Zod, `src/shared/validators`)
- createFinancialCenterSchema: name, type, is_active? — financial-center.ts
- updateFinancialCenterSchema: name?, type?, is_active? — financial-center.ts
- listFinancialCentersQuerySchema: limit?, page?, search?, includeInactive? — financial-center.ts
- quickCreateFinancialCenterSchema: name, type — financial-center.ts

## Regras de negócio
- Excluir centro com lançamentos é recusado (`ConflictError`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- Nomes de receitas terminam com **(CR)** e de despesas com **(DB)**, sem acumular sufixos. Na manutenção, Despesa fica laranja e Receita verde.
- **Importar Excel** (`.xlsx`/`.xls`, até 2 MB e 5.000 linhas): coluna Nome ou Endereço (pode vir após linhas de título), coluna Tipo opcional (Receita/CR, Despesa/DB); sem tipo, o usuário escolhe receitas, despesas ou ambos. Gera prévia, ignora nomes repetidos na planilha e centros já cadastrados, mostra a empresa de destino e revalida tudo no servidor antes da inserção atômica. Fórmulas, nomes vazios e tipos inválidos bloqueiam.
- A listagem carrega todas as páginas de centros (não corta nos primeiros 100).
- Centros usados por mais de um imóvel não têm valores atribuídos a um imóvel no ROI.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Centro não encontrado | crud.ts |
| ValidationError | Nome do centro é obrigatório | crud.ts |
| ValidationError | Tipo de centro inválido. Deve ser INCOME (Receita) ou EXPENSE (Despesa) | crud.ts |
| ValidationError | O nome do centro não pode ser vazio | crud.ts |
| ValidationError | Centro não está excluído | crud.ts |
| ValidationError | Nome é obrigatório | crud.ts |
| ValidationError | Tipo é obrigatório | crud.ts |
