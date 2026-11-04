# Relatórios e dashboards de múltiplas empresas

O campo **Empresas** aparece somente para `SUPER_ADMIN`. O padrão **Atual** usa a empresa da sessão. O usuário pode pesquisar e marcar empresas ativas e aplicar a seleção em **Concluir**. A seleção vale para a página aberta e não troca a empresa autenticada.

Categorias equivalentes são consolidadas por nome e tipo (receita/despesa). Subcategorias incluem também o nome e o tipo da categoria pai. Tipos de imóveis usam a descrição. As comparações normalizam Unicode, espaços e maiúsculas/minúsculas, preservando acentos. Os cadastros originais não são copiados ou alterados.

O servidor verifica o papel root e a disponibilidade de todas as empresas antes de iniciar o contexto de leitura. Escritas, usuários, preferências e configurações permanecem na empresa da sessão. Contratos antigos com o mesmo número em empresas diferentes são associados somente dentro da empresa do lançamento.

Os totais financeiros mensais, despesas por categoria/subcategoria e anos disponíveis usam agregações no banco. O relatório de locações busca todos os meses selecionados em lote. O armazenamento compartilha uma leitura do bucket e limita a concorrência de consultas de metadados. Testes com seleção de 100 empresas verificam que o número de consultas dos totais mensais e das locações não cresce por empresa.

## Publicação

Aplicar as migrations pendentes pelo processo habitual de implantação (`npx prisma migrate deploy`), incluindo `20261006010000_reporting_indexes`, que adiciona índices parciais por empresa e período. A migration foi adicionada ao repositório; o banco remoto não foi alterado durante este trabalho.

## Verificação

- `npx vitest run`: regras de acesso, isolamento de escritas, equivalência com categoria pai, consultas em lote e cálculos de investimentos.
- `npm run test:reporting-ui`: seletor root, aplicação ao concluir, busca, empresa atual, empresas inativas e layout móvel.
- `npm run test:investments-ui`: rendimento de R$ 18.998,32 e independência de 94,99% para uma referência de R$ 20.000,00, cadastro com valor zero e configuração de colunas.
- `npm run build`: compilação de produção.

Os testes de volume usam dados simulados e contagem de consultas; não representam uma medição de latência sobre 100 clientes em produção.
