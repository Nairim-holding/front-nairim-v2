# Auditoria de IPTU

Auditoria de IPTU: compara restituições e pagamentos de IPTU por imóvel, mês e ano, com configuração das categorias usadas.

| Aspecto | Detalhe |
|---|---|
| Menu | Auditoria > IPTU |
| Rota | `/dashboard/financeiro-auditoria` |
| Permissão | recurso `financial-audit` (ver, criar, editar, excluir) |
| Modelos Prisma | `IptuAuditSettings`, `PropertyIptu` |
| Server | `server/actions/iptu-audit.ts`, `server/queries/iptu-audit.ts` |
| Domínio | `core/use-cases/iptu-audit/report.ts`, `core/use-cases/iptu-audit/settings.ts`, `core/entities/iptu-audit.ts` |
| Infra | `infra/repositories/prisma-iptu-audit-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Configuração (`IptuAuditSettings`) define categoria e subcategoria de restituição e pagamento por empresa; relatório usa lançamentos concluídos.
2. Detalhes por imóvel mostram o tipo do imóvel depois do nome. O comparativo mensal/anual agrupa lançamentos por período com data, imóvel, tipo, inquilino e contrato (quando vinculados), descrição, restituição, pagamento e saldo.
3. Pagamentos manuais sem locação continuam, identificados como "sem inquilino vinculado".
4. Recurso de permissão `financial-audit` (mesmo do ROI).
