# Relatórios de locações

Relatório de locações (uma linha por contrato e competência, com quadros fiscais) e relatório de atrasos de repasse, com exportação.

| Aspecto | Detalhe |
|---|---|
| Menu | Locações > Relatórios |
| Rota | `/dashboard/locacoes/relatorios`, `/dashboard/locacoes/relatorios/atrasadas` |
| Permissão | recurso `lease-reports` (ver, criar, editar, excluir) |
| Modelos Prisma | — |
| Server | `server/actions/lease-report.ts`, `server/queries/lease-report.ts` |
| Domínio | `core/entities/lease-report.ts`, `core/entities/lease-report-matching.ts` |
| Infra | `infra/repositories/prisma-lease-reports-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Uma linha por contrato e competência do evento financeiro, inclusive pagamentos de vários meses recebidos juntos; a seleção de apuração e os quadros fiscais seguem o mês do recebimento.
2. **Condomínio (Receita)** vem de lançamentos de receita; sem eles, usa o condomínio da locação uma vez por competência com aluguel recebido. Despesas de condomínio ficam fora. O condomínio compõe o líquido e tem total próprio.
3. Ordem personalizada anterior por contrato continua válida; novas ordens usam contrato/competência.
4. **Relatório de atrasos** (`/dashboard/locacoes/relatorios/atrasadas`): repasses pendentes vencidos antes da data limite, inclusive contratos encerrados; imobiliária, imóvel, competência, contrato, locatário, vencimento, dias e valor; total e Excel/PDF/impressão; pendências sem vínculo inequívoco viram aviso.
5. Receita bruta usada também pelo Resumo: aluguel `COMPLETED`, sem comissão, IPTU ou multa (`classifyLeaseReportTransaction`).
6. Seletor de empresas só para `SUPER_ADMIN`; leituras em lote para vários meses.
