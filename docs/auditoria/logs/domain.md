# Logs de auditoria — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### AuditLogOutbox
- Campos: user_id: String?; user_name: String?; user_email: String?; action: AuditAction; table_name: String; record_id: String?; old_values: Json?; new_values: Json?; ip: String?
- Relações: —
- Padrão: id, company_id, created_at

## Entidades e tipos (`src/core/entities`)
`GetAuditLogsParams`, `AuditLogRow`, `ChangedField`, `AuditLogDetail`, `PaginatedAuditLogs`, `AuditFilterOption`, `AuditFiltersResponse`

## Validação (Zod, `src/shared/validators`)
- listAuditLogsQuerySchema: limit?, page?, search?, filters?, sortOptions? — audit-log.ts

## Regras de negócio
- O histórico mora na coleção `audit_logs` do **MongoDB**; no PostgreSQL só existe a fila temporária `AuditLogOutbox`, alimentada por triggers na mesma transação da alteração. **Não remova `AuditLogOutbox`.**
- Registra criação, alteração e exclusão de tabelas de negócio (inclusive lote e tabelas filhas), login e falha de login, exportação/importação, backups e exportações Excel/PDF. Credenciais ficam fora dos snapshots; operação revertida não deixa log.
- A tela filtra por período e tem botão Atualizar; ordenação estável. Logs de falha de login sem empresa identificável ficam isolados e não aparecem para administradores de empresa.
- Tabela nova de negócio precisa de trigger de auditoria na migration e rótulo em `shared/utils/audit-models.ts`.
- Operação, Docker, worker e expurgo: [operacao.md](operacao.md).

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | queries.ts |
| NotFoundError | Log não encontrado | queries.ts |
