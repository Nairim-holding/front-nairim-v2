# Locações

Contratos de locação: cadastro em etapas, geração dos lançamentos financeiros mensais, cancelamento, documentos, histórico financeiro e alertas de vencimento.

| Aspecto | Detalhe |
|---|---|
| Menu | Locações > Locações |
| Rota | `/dashboard/locacoes` |
| Permissão | recurso `leases` (ver, criar, editar, excluir) |
| Modelos Prisma | `Lease`, `LeaseExpiryReminder` |
| Server | `server/actions/lease.ts`, `server/actions/lease-expiry.ts`, `server/queries/lease.ts`, `server/queries/lease-financial-history.ts` |
| Domínio | `core/use-cases/lease/cancellation.ts`, `core/use-cases/lease/crud.ts`, `core/use-cases/lease/documents.ts`, `core/entities/lease.ts`, `core/entities/lease-expiry.ts`, `core/entities/lease-financial-history.ts` |
| Infra | `infra/repositories/prisma-leases-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Número de contrato é único por empresa. Antes de salvar o servidor confere os vínculos financeiros do imóvel (6 campos) e da imobiliária (categoria, subcategoria, % comissão), com mensagem orientando onde corrigir (`lease-financial-setup`).
2. A geração mensal cria aluguel e, se informado na locação, **condomínio** (no dia de vencimento próprio ou do aluguel), usando categoria e centro de receita do imóvel. O condomínio gerado não conta como aluguel no ROI. A sincronização preserva parcelas quitadas, lançamentos avulsos e condomínio avulso.
3. Cancelar encerra as pendências futuras; dívidas anteriores ao cancelamento continuam visíveis ("Pendência anterior ao cancelamento"). Lançamentos formalmente cancelados não podem ser restaurados. Prévia em `getCancellationPreviewAction`.
4. Contrato vigente até o fim do dia final (fuso São Paulo); depois, o imóvel é liberado se não houver outra locação não cancelada vigente. Troca de imóvel recalcula os dois.
5. **Histórico Financeiro** reúne lançamentos vinculados, cancelados sem recebimento e candidatos antigos que podem ser vinculados (`linkTransactionsToLeaseAction`); cabeçalho e títulos ficam fixos na rolagem; despesas concluídas em vermelho, receitas em verde; tipo mostra "Receita/Despesa Recorrente".
6. Alertas de vencimento (`getLeaseExpiryAlertsAction`) mostram imóvel, inquilino, vencimento, índice de reajuste e dias restantes; `acknowledgeLeaseExpiryAction` registra a ciência (`LeaseExpiryReminder`).
7. Exclusão definitiva só por `permanentlyDeleteLeaseAction`; a exclusão comum é lógica.
