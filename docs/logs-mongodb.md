# Logs em MongoDB

O histórico de auditoria é armazenado na coleção `audit_logs` do MongoDB. A página de Auditoria lê essa coleção; os cadastros continuam no PostgreSQL. Configurações tem exportação JSON própria e expurgo por idade, intervalo de datas, ação, autor e recurso, sempre limitado à empresa autenticada.

O expurgo exige administrador e permissão `audit-logs/delete`; exportar exige administrador e `audit-logs/export`. A matriz de permissões permite conceder essas ações. O usuário confere a quantidade e digita `EXCLUIR LOGS`. A confirmação vale por 10 minutos, pertence ao usuário e à empresa, e não inclui logs recebidos depois da prévia. Não há expurgo automático habilitado.

## Docker local

1. Configure as variáveis de `.env.example` no `.env`. Use uma senha aleatória (hexadecimal evita escape na URI).
2. Execute `docker compose -f docker-compose.logs.yml up -d mongodb-logs`.
3. Gere o cliente com `npx prisma generate`.
4. Valide com `node --env-file=.env scripts/migrate-logs-database.mjs`; aplique com o mesmo comando mais `--apply`. Esse procedimento aplica somente as duas migrações de auditoria e registra seus checksums no Prisma. Em instalações com todas as migrações anteriores aplicadas, também é possível usar o fluxo normal `prisma migrate deploy`.
5. Execute `npm run logs:up` para construir e iniciar o serviço de transferência. Reinicie o servidor Next após atualizar o cliente e o `.env`.

MongoDB: `nairim-mongodb-logs`, porta local `127.0.0.1:27018`, volume persistente `nairim_mongodb_logs_data`. Serviço de transferência: `nairim-logs-worker`, reinício automático. `LOGS_WORKER_DATABASE_URL` deve apontar para o mesmo banco principal de `DATABASE_URL`, substituindo localhost por `host.docker.internal` no Docker local.

## Garantia de entrega e migração

### Transferir e remover a tabela antiga em um comando

Execute `npm run logs:export-and-drop` na raiz do projeto. O comando usa `DATABASE_URL`, `MONGODB_LOGS_URI` e `MONGODB_LOGS_DATABASE` do `.env`. Para escolher outro ambiente, execute `node --env-file=.env.homolog scripts/export-and-drop-legacy-logs.mjs`.

Antes de executar, interrompa as versões antigas da aplicação que ainda gravam em `AuditLog`. O script migra **todas as empresas**, em lotes de 500, confirma a escrita durável e compara cada campo original no MongoDB. Ele mantém a tabela antiga bloqueada durante a conferência, redireciona os gatilhos para a fila de entrega e executa `DROP TABLE "AuditLog" RESTRICT` somente depois da verificação. Qualquer cópia ausente, divergência ou dependência inesperada interrompe a operação e reverte as alterações no PostgreSQL. As cópias já confirmadas no MongoDB permitem repetir a execução sem duplicação.

Se a tabela antiga já tiver sido removida pela migração anterior, o comando apenas confere e esvazia as entregas pendentes. `AuditLogOutbox` é preservada: é a fila temporária necessária para tolerar falhas de conexão, e não o armazenamento permanente dos logs. O script exige a estrutura Prisma existente e registra as migrações de auditoria como aplicadas.

Os gatilhos do PostgreSQL gravam numa fila temporária `AuditLogOutbox`, na mesma transação da alteração. Assim, operações revertidas não deixam logs falsos e operações aninhadas/em lote continuam auditadas. A antiga tabela `AuditLog` é renomeada para essa fila, preservando todo o histórico até sua entrega.

O serviço transfere lotes de 500 a cada dois segundos, com identificadores estáveis e escrita MongoDB confirmada em journal. Somente após a confirmação ele remove as entradas da fila. Uma falha mantém os dados pendentes; repetir a transferência não duplica os documentos. Não existe histórico permanente de logs no PostgreSQL. Logins também usam essa fila para tolerar indisponibilidade do MongoDB.

O expurgo usa o mesmo bloqueio de transferência e recusa a exclusão enquanto houver registros pendentes da empresa; isso impede que uma repetição de entrega recupere logs já expurgados. Outras empresas não são apagadas. Logins falhos sem empresa identificável permanecem isolados no MongoDB e não são expostos a administradores de empresa.

O backup principal não inclui os logs. A exportação JSON separada permite guardar uma cópia, mas não há restauração de logs pela interface nesta versão. Para recuperação integral do MongoDB use backup operacional do banco/volume; remover o volume Docker perde o histórico.

## Produção e ambientes

O compose principal inclui os serviços de logs e configura o endereço interno no frontend de produção. Defina `LOGS_WORKER_DATABASE_URL` com o endereço do PostgreSQL acessível ao serviço e `MONGODB_LOGS_DATABASE` exclusivo por ambiente. Teste e homologação precisam de conexões próprias e um serviço de transferência para cada PostgreSQL; não devem compartilhar a coleção de produção. Não execute a migração com instâncias antigas do aplicativo ainda gravando em `AuditLog`: interrompa as instâncias antigas e publique o novo cliente junto com a migração.

Verifique `docker logs --tail 20 nairim-logs-worker` e a quantidade pendente em Configurações. Se o MongoDB ficar indisponível, a fila cresce até a reconexão; monitore espaço em disco. Não descarte a fila manualmente.

## Validação

`npx vitest run src/shared/validators/log-management.test.ts src/infra/database/audit-context.test.ts`

`node --test worker/logs/transfer.test.mjs`
