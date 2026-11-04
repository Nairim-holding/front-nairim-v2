# Detalhamento e origem dos valores do ROI

Na tela ROI por Imóvel, clicar em uma linha abre o detalhamento em um modal. O detalhamento permanece fechado até a interação do usuário, inclusive quando a tabela tem somente um imóvel.

Os valores da tabela, do rodapé da carteira e do detalhamento são clicáveis. A consulta de origem mostra o valor atualizado, a fórmula, seus componentes e os registros que participaram do cálculo:

- Cadastro do imóvel: valor e data da compra, além da vacância prevista, conforme a métrica.
- Financeiro: lançamentos realizados, com datas de evento e efetivação, descrição, categoria, subcategoria, centro, conta e valor.
- Locações: contratos usados na contagem de meses locados, incluindo o limite de encerramento, cancelamento ou data atual. Sobreposições de períodos contam uma única vez.

Os componentes também permitem consultar sua própria origem. Ao clicar em um componente dentro do bloco de um imóvel da carteira, a nova consulta fica restrita àquele imóvel. O botão Voltar preserva a seleção anterior. Escape, botão Fechar e clique no fundo fecham o modal e devolvem o foco ao controle que o abriu.

## Consistência do cálculo

Relatório e origem compartilham as consultas, os filtros e as entradas de cálculo. As fórmulas do ROI permanecem as mesmas. Os componentes exibem casas decimais adicionais quando necessário para explicar operações que usam intermediários sem arredondamento.

O investimento inicial e os aluguéis consideram todo o histórico. Despesas periódicas usam o período selecionado e são convertidas para 12 meses. A separação entre reforma inicial e manutenção periódica usa o mesmo limite inclusivo de um ano após a compra. Centros usados por mais de um imóvel não têm seus valores atribuídos a um imóvel isoladamente.

Os indicadores da carteira são calculados sobre as somas do rodapé, e não pela soma ou média dos indicadores de cada imóvel. O aluguel mensal não tem total no rodapé.

A origem é consultada quando o usuário abre o valor. Se os dados mudarem após o carregamento da tabela, o modal apresenta o cálculo atualizado. Falhas exibem Tentar novamente; respostas de consultas já fechadas ou substituídas são descartadas.

## Acesso e implementação

`getRoiOriginAction` exige a permissão de visualização de Auditoria Financeira e recebe período, métrica e uma seleção explícita de imóveis. Os registros são restritos à empresa da sessão; IDs fora desse escopo retornam Imóvel não encontrado.

Os tipos e dependências de cada métrica estão em `src/core/entities/property-roi-origin.ts`. O modal está em `src/app/dashboard/(financeiro)/roi/_components/RoiInspectionModal.tsx`.

## Verificação

```powershell
npm run test:roi-detail-ui
npm run test:roi-ui
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

O teste da interface usa componentes e exportações reais com sessão e consultas simuladas. Confere abertura e fechamento, valores individuais e totais, componentes por imóvel, carregamento e recuperação de falhas, resposta atrasada, teclado, foco, celular e exportações Excel/PDF. Nenhum banco real é alterado.
