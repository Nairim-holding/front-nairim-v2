# Meus Investimentos

- O valor investido do cadastro aceita R$ 0,00, tanto na criação quanto na edição. Aportes e resgates novos continuam exigindo valor positivo.
- O botão **Exibir e ordenar colunas** abre o mesmo personalizador das demais tabelas. Ao concluir, salva ordem e visibilidade para o usuário e a empresa. Produto, Emissor, Instituição, Vencimento e Observações podem ser ocultados ou reordenados. A seleção de investimentos, os rótulos Aplicado/Saldo Total e os meses continuam disponíveis.
- Excel e PDF usam as colunas que estão visíveis na tabela.

## Rendimento mensal

O capital inicial vem do campo **Valor investido**. O aporte automático correspondente, quando existe, é contado uma única vez. Os demais aportes e resgates permanecem no cálculo.

Rendimento do mês = saldo final − saldo anterior − aportes líquidos do mês.

No primeiro mês do histórico, o valor investido é a base inicial. Nos meses seguintes, o cálculo usa o saldo anterior, incluindo saldos informados fora do período selecionado.

Exemplo de janeiro de 2025:

| Produto | Valor investido | Saldo final | Rendimento |
| --- | ---: | ---: | ---: |
| PGBL – Classico IV FIC Renda Fixa | R$ 1.137.238,76 | R$ 1.148.951,94 | R$ 11.713,18 |
| VGBL – Classico IV FIC Renda Fixa | R$ 707.318,13 | R$ 714.603,27 | R$ 7.285,14 |
| Total | | | **R$ 18.998,32** |

Estas alterações de investimentos não exigem nova migração de banco.

## Verificação

`npx vitest run` verifica as regras, validações e a integração do repositório com consultas simuladas.

Após `npm run build`, `npm run test:investments-ui` verifica a página real em Chromium, com sessão e ações do servidor simuladas, sem acessar o banco. Cobre o valor inicial zero, o exemplo acima, a ordem Produto → Emissor → Instituição → Vencimento, persistência após recarregar, todas as colunas ocultas e a tela móvel.
