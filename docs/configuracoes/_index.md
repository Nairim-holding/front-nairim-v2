# Configurações

Configurações da empresa: backup e restauração, transferência de cadastros em JSON, exclusão de dados por grupo e gerenciamento de logs.

| Aspecto | Detalhe |
|---|---|
| Menu | Configurações |
| Rota | `/dashboard/configuracoes` |
| Permissão | recurso `settings` (ver, criar, editar, excluir) |
| Modelos Prisma | `Company`, `CompanyBranding` |
| Server | `server/actions/backup.ts`, `server/actions/table-transfer.ts`, `server/actions/company-data-deletion.ts`, `server/actions/log-management.ts` |
| Domínio | `core/use-cases/backup/crud.ts`, `core/use-cases/transfer/ensure-categories.ts`, `core/entities/backup.ts`, `core/entities/transfer.ts` |
| Infra | — |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md) · [transferencia-de-tabelas.md](transferencia-de-tabelas.md)

## Para mexer neste módulo, saiba que
1. Backup completo contém hashes de senha e controle de acesso: exportar, baixar e restaurar exigem `SUPER_ADMIN`. Upload de restauração até 50 MB.
2. **Transferência JSON**: ver [transferencia-de-tabelas.md](transferencia-de-tabelas.md). Registro de tabelas em `shared/data/table-transfer.ts`; metadados gerados por `npm run generate:table-models`.
3. **Exclusão de dados**: só administradores com permissão de exclusão em Configurações e em cada recurso; seleção múltipla ou todos os grupos, prévia da quantidade e confirmação exata `CONFIRMAR`; empresa da sessão comparada com a da revisão; serializável, em ordem de dependência, com reversão integral. Preserva empresa, identidade visual, usuários, grupos, preferências e auditoria; arquivos físicos permanecem no armazenamento. Grupos em `shared/data/company-data-deletion.ts`.
4. **Logs**: expurgo por idade, intervalo, ação, autor e recurso, limitado à empresa; exige `audit-logs/delete`, confirmação `EXCLUIR LOGS` válida por 10 minutos e recusa expurgar se houver registros pendentes na fila. Exportação JSON exige `audit-logs/export`. Ver `docs/auditoria/logs/`.
5. Nenhuma ação destrutiva roda em ambientes publicados sem pedido explícito; as telas mostram prévia antes de confirmar.
