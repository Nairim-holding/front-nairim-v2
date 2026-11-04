# Correções 54

Documento de 03/11/2026. A implementação parte do commit `a56c9b6` das correções 53.

## Demonstrativo financeiro

`src/app/dashboard/(financeiro)/relatorios/_components/DemonstrativoView.tsx` mostra percentuais para receitas e despesas, tanto nas linhas principais quanto nos grupos expandidos. A Receita Bruta representa 100,00%; cada receita usa seu valor dividido pela Receita Bruta. Sem receita positiva, o indicador mostra travessão, evitando divisão por zero. O Resultado mantém o percentual de despesas comprometidas.

Com receita bruta de R$ 32.024,75: Aluguéis R$ 31.827,91 → 99,39%; Entrada de Recursos R$ 1,19 → 0,00%; Rendimentos R$ 104,39 → 0,33%; Restituição de IPTU R$ 91,26 → 0,28%. O exemplo usa R$ 91,26 da imagem do documento, que fecha o total de R$ 32.024,75 (o texto menciona R$ 91,25).

## Investimentos

A regra existente usa capital inicial do cadastro, desconta aportes líquidos do mês e preserva o saldo do mês anterior fora do filtro. Os testes reproduzem os valores do documento: PGBL R$ 11.713,18 + VGBL R$ 7.285,14 = R$ 18.998,32; referência de R$ 20.000,00 → 94,99%; Aplicado zero sem novos movimentos.

`src/app/dashboard/(financeiro)/investimentos/content.tsx` ignora respostas de consultas anteriores após nova recarga, mudança de período/filtro ou desmontagem. Uma consulta antiga não pode substituir os indicadores atuais nem encerrar o carregamento mais recente. Não há alteração de saldos ou configuração de referências no banco.

## Verificação

- `npm run test:correcoes53-ui`: inclui os percentuais de receitas do #54 e receita zero.
- `npm run test:investments-ui`: inclui aplicação em 31/12/2024 e resposta antiga chegando após recarga mais recente.
- `npm test`: inclui evolução de janeiro para fevereiro usando o histórico anterior.
- TypeScript e ESLint dos arquivos alterados.

Testes de interface usam componentes reais com actions simuladas. A conferência em produção depende de login e dos investimentos cadastrados na empresa correta. Sem nova migration.
