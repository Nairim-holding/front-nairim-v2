# Reparos — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Repair
- Campos: property_id: String; event_date: DateTime; event_type: String; problem_type: String; problem_types: String[]; description: String; professional: String; supplier_id: String?; service_amount: Decimal; materials_amount: Decimal; payment_method: String; payment_conditions: String; status: String; start_date: DateTime?; completion_date: DateTime?; notes: String?
- Relações: company → Company; property → Property; supplier → Supplier; media[] → RepairMedia; professionals[] → RepairProfessional; items[] → RepairItem
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### RepairItem
- Campos: repair_id: String; description: String; kind: String; supplier_id: String; professional: String; amount: Decimal; position: Int
- Relações: company → Company; repair → Repair; supplier → Supplier
- Padrão: id, company_id

### RepairProfessional
- Campos: repair_id: String; supplier_id: String
- Relações: company → Company; repair → Repair; supplier → Supplier
- Únicos compostos: repair_id, supplier_id
- Padrão: id, company_id

### RepairMedia
- Campos: repair_id: String; stage: String; filename: String; url: String; content_type: String
- Relações: company → Company; repair → Repair
- Padrão: id, company_id, created_at

## Entidades e tipos (`src/core/entities`)
`REPAIR_EVENT_LABELS`, `REPAIR_PROBLEM_LABELS`, `REPAIR_STATUS_LABELS`, `RepairMedia`, `REPAIR_ITEM_LABELS`, `RepairItem`, `Repair`

## Validação (Zod, `src/shared/validators`)
- repairDetailsSchema: items? — repair.ts
- repairSchema: supplier_id?, supplier_ids?, items? — repair.ts
- repairListSchema: search?, status?, from? — repair.ts

## Regras de negócio
- Recurso de permissão `repairs`. Lista à esquerda e formulário ao lado (empilhados em telas estreitas), padrão da tela de Contatos.
- Situação: planejado, em andamento, concluído ou cancelado; **concluído exige data de conclusão**. Lista com 25 por página; busca por imóvel, descrição e profissional; filtros por imóvel, situação e período.
- Responsáveis são Contatos do Financeiro (`supplier_id`), ativos e da empresa; nome novo (2–150 caracteres) pode ser criado ao salvar se houver permissão de criar contatos.
- Com itens (descrição, tipo mão de obra/materiais, contato, valor), os totais são calculados em centavos na tela e no servidor; sem itens valem os campos gerais (registros antigos).
- Mídias (Antes e Depois): até 10 arquivos de 20 MB por etapa (JPG, PNG, WebP, AVIF, MP4, WebM); imagens compatíveis são convertidas para AVIF; exclusão de mídia remove registro e arquivo; exclusão do reparo é lógica.
- Backup e auditoria incluem reparos; mídias vão por URL, sem embutir arquivos.
