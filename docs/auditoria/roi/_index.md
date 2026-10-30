# ROI por imóvel

ROI por imóvel: retorno sobre o investimento calculado pela planilha do cliente, com configurações, cenário de valorização e detalhamento da origem dos valores.

| Aspecto | Detalhe |
|---|---|
| Menu | Auditoria > ROI |
| Rota | `/dashboard/roi` |
| Permissão | recurso `financial-audit` (ver, criar, editar, excluir) |
| Modelos Prisma | `RoiSettings` |
| Server | `server/actions/property-roi.ts`, `server/queries/property-roi.ts` |
| Domínio | `core/entities/property-roi.ts`, `core/entities/property-roi-origin.ts` |
| Infra | `infra/repositories/prisma-property-roi-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md) · [origem-dos-valores.md](origem-dos-valores.md)

## Para mexer neste módulo, saiba que
1. Recurso de permissão `financial-audit`. Configuração por empresa em `RoiSettings` (categorias, subcategorias e centros considerados; opções **Não considerar** e **Todas as subcategorias**).
2. Investimento inicial e aluguéis usam todo o histórico; despesas periódicas usam o período e são convertidas para 12 meses; reforma inicial vs manutenção periódica separadas pelo limite inclusivo de um ano após a compra.
3. Indicadores da carteira vêm das somas do rodapé, não de média dos imóveis. O aluguel mensal não tem total.
4. Condomínio mensal gerado não é somado como aluguel. Centros usados por mais de um imóvel não são atribuídos a um imóvel só.
5. Cenário de valorização: valor de compra editável por imóvel só na simulação; nada é salvo; ao sair da aba restaura o cadastro.
6. Origem dos valores (`getRoiOriginAction`): tipos em `core/entities/property-roi-origin.ts`; detalhes em [origem-dos-valores.md](origem-dos-valores.md).
7. A migration `20261013010000_property_roi` recria `RoiSettings` (removida em 18/08 e reimplementada em 13/10).
