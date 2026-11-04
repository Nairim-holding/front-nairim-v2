# Logs de auditoria — Histórico

Atualize aqui a cada alteração no módulo. Mais recente primeiro.

### 2026-10-07 — Cobertura completa
- Migration `20261007000000_complete_audit_coverage`: ações `EXPORT` e `IMPORT`, um gatilho por tabela de reparos, valores de índices, notificações, lembretes, favoritos, colunas e layouts; IP do usuário nas alterações.

### 2026-09-11 — Logs no MongoDB
- Migration `20260911000000_move_logs_to_mongodb`: `AuditLog` virou a fila `AuditLogOutbox`.

### 2026-09-08 — Trilha de auditoria restaurada
- Migration `20260908000000_restore_audit_trail` com triggers e autor por transação.

### 2026-10-30 — Documentação inicial
- **Arquivos:** esta pasta. **Razão:** economizar leitura de código em futuras sessões.
