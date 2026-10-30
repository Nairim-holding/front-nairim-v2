# Logs de auditoria

Tela de Logs: histórico de auditoria (quem alterou o quê, com valores antes e depois), lido do MongoDB.

| Aspecto | Detalhe |
|---|---|
| Menu | Auditoria > Logs |
| Rota | `/dashboard/auditoria` |
| Permissão | recurso `audit-logs` (ver, criar, editar, excluir) |
| Modelos Prisma | `AuditLogOutbox` |
| Server | `server/actions/audit-log.ts`, `server/actions/export-audit.ts`, `server/queries/audit-log.ts` |
| Domínio | `core/use-cases/audit-log/queries.ts`, `core/entities/audit-log.ts` |
| Infra | — |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md) · [operacao.md](operacao.md)

## Para mexer neste módulo, saiba que
1. O histórico mora na coleção `audit_logs` do **MongoDB**; no PostgreSQL só existe a fila temporária `AuditLogOutbox`, alimentada por triggers na mesma transação da alteração. **Não remova `AuditLogOutbox`.**
2. Registra criação, alteração e exclusão de tabelas de negócio (inclusive lote e tabelas filhas), login e falha de login, exportação/importação, backups e exportações Excel/PDF. Credenciais ficam fora dos snapshots; operação revertida não deixa log.
3. A tela filtra por período e tem botão Atualizar; ordenação estável. Logs de falha de login sem empresa identificável ficam isolados e não aparecem para administradores de empresa.
4. Tabela nova de negócio precisa de trigger de auditoria na migration e rótulo em `shared/utils/audit-models.ts`.
5. Operação, Docker, worker e expurgo: [operacao.md](operacao.md).
