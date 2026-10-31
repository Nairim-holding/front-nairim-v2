# Conferência das correções 53

Documento de 29/10/2026, conferido em 31/10/2026 a partir do commit `881fd81` (`fix: correções #53`).

| Item | Comportamento e fonte |
|---|---|
| 1 — Demonstrativo | `DashboardDemonstrativoWidget` usa `ChartCard` para arrastar pelo título e abrir em tela cheia. O grid salva a posição por usuário. `DemonstrativoView` abre os lançamentos nas 12 colunas padrão; todas as linhas têm 13 colunas físicas, incluindo a alça de expansão. |
| 1 — Percentuais | Despesa / Receita Bruta × 100; Resultado mostra o comprometimento total da receita. Exemplo do documento: 34,44%, 88,96%, 10,69%, 24,03% e 158,12%. Sem receita, exibe travessão. |
| 2 — Impostos | `TaxesWidget` usa a linha `impostos` do mesmo DFC, sem estimar IPTU/condomínio dos imóveis. O modal lista os lançamentos agrupados por subcategoria. Exemplo de outubro: R$ 10.993,00. |
| 3 — Locações | O commit conferido consolida imóvel/inquilino/competência, alinha os totais exportados e reorganiza os quadros fiscais impressos. O complemento faz a tela incluir também o imposto da aplicação no total trimestral, como a impressão. |
| 4 — Investimentos | As regras já implementadas reproduzem rendimento R$ 18.998,32 e independência 94,99% com referência R$ 20.000,00. Aplicado é zero sem novos movimentos. Fevereiro usa o saldo de janeiro mesmo quando janeiro fica fora do filtro. |

## Verificação reproduzível

- `npm test`: regras de domínio, repositórios e igualdade dos totais trimestrais da tela e impressão.
- `npm run test:correcoes53-ui`: componentes reais em Chromium, com actions simuladas. Confere percentuais, detalhes, card de impostos, mudança de posição persistida e abertura/fechamento da tela cheia.
- `npm run test:investments-ui`: página real com actions simuladas, incluindo os valores do item 4.
- `npx tsc --noEmit` e ESLint nos arquivos alterados.

Os números de referência são cenários de teste; não representam consulta ao banco de produção. Nenhuma migration é necessária. Documentação relacionada: [relatórios financeiros](../financeiro/relatorios/_index.md), [relatórios de locações](../locacoes/relatorios/_index.md) e [rendimento dos investimentos](../financeiro/investimentos/rendimento.md).
