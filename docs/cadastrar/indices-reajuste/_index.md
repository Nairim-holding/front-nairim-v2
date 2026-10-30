# Índices de reajuste

Indexadores de reajuste de aluguel (IGP-M, IPCA etc.) com os percentuais mensais, que podem ser atualizados pelo Banco Central.

| Aspecto | Detalhe |
|---|---|
| Menu | Cadastrar > Índices de Reajuste |
| Rota | `/dashboard/indices-reajuste` |
| Permissão | recurso `adjustment-indexes` (ver, criar, editar, excluir) |
| Modelos Prisma | `AdjustmentIndex`, `AdjustmentIndexValue` |
| Server | `server/actions/adjustment-index.ts`, `server/queries/adjustment-index.ts` |
| Domínio | `core/use-cases/adjustment-index/crud.ts`, `core/entities/adjustment-index.ts` |
| Infra | `infra/repositories/prisma-adjustment-indexes-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Cada indexador tem sigla e descrição obrigatórias e valores por mês/ano (`AdjustmentIndexValue`); gravação é idempotente por indexador+ano+mês.
2. `AdjustmentIndexValue` não tem `company_id`: o isolamento vem do indexador pai.
3. O botão **Atualizar pelo Banco Central** e a rotina `GET /api/cron/adjustment-indexes` usam o mesmo caso de uso e a API SGS do BCB (`infra/services/bcb-sgs-client.ts`). A rotina exige `Authorization: Bearer $CRON_SECRET`, percorre as empresas ativas e deve rodar uma vez por mês.
4. Série sem dados no BCB (ex.: IVAR) não é sincronizada; o percentual pode ser lançado à mão.
5. Os índices aparecem nos alertas de vencimento de contratos (índice de reajuste e dias restantes).
