# Resumo — Histórico

Atualize aqui a cada alteração no Resumo. Mais recente primeiro.

### 2026-10-30 — Correções de 28/10 (Demonstrativo e Impostos)
- **Demonstrativo (widget-21):** agora é arrastável como os demais (usa `ChartCard`: a barra do título é a alça) e tem botão **Expandir** em tela cheia.
- Ao abrir um grupo (+), os lançamentos aparecem nas mesmas 12 colunas dos demais blocos (Competência, Data efetiva, Descrição, Valor, Tipo, Categoria, Subcategoria, Conta, Cartão, Contato, Centro, Status), em células da mesma tabela (a exportação Excel/PDF continua lendo o DOM).
- Nova coluna **%** após o valor: despesa ÷ Receita Bruta × 100; na linha Resultado, total de despesas ÷ Receita Bruta (acima de 100% = gastou mais do que faturou).
- **Card Total de Impostos e Taxas (widget-13):** deixou de ser a estimativa IPTU+condomínio por imóvel; é a linha **Impostos** do Demonstrativo (categorias classificadas como Impostos no DFC), no período, regime e filtros do Resumo. Clicar abre os lançamentos agrupados por subcategoria (`TaxesWidget.tsx`).

### 2026-10-26 — Cards do Financeiro e Demonstrativo
- **Arquivos:** `components/dashboard/FinancialDashboardGrid/*`, `prisma-dashboard-repository.ts`.
- **Razão:** corrigir o total de aluguéis do resumo e acrescentar o Demonstrativo Financeiro (`widget-21`) ao painel.
- **Impacto:** `widget-21` aparece automaticamente para quem já tinha preferências salvas.

### 2026-10-21 — Correções 51: resumo financeiro
- Carteira considera imóveis cadastrados até o fim do período, inclusive os anteriores ao mês selecionado.
- Aluguéis incluem imóveis ocupados e disponíveis, excluindo vendidos; taxas deixam de ignorar imóveis antigos.
- Aquisição, índice de vacância e meses de vacância foram retirados da aba Financeiro.

### 2026-10-21 — Tooltips (correções 51)
- Gráfico mensal: tooltip mostra **Saldo = Receita − Despesa** no rodapé, com o fundo do cabeçalho; o saldo também aparece nos dados detalhados.
- Centros no tema escuro: tooltip acompanha as cores do tema; controle vertical de navegação mais estreito, sem a faixa roxa.

### 2026-10-09 — Gráfico por centro
- Apenas receitas e despesas; nomes largos quebram linha; separadores entre imóveis; detalhamento por clique preservado; no celular a rolagem fica dentro do gráfico.

### 2026-10-14 — Correções 48
- Receitas e Despesas por Centro: linha **Saldo** no tooltip com o mesmo fundo do título; saldo também na tabela de dados.

### 2026-10-02 — Correções 44
- Gráfico Receitas e Despesas por Centro (verde receitas, vermelho despesas), por data efetiva, período e filtros da aba; exclui transferências; centros homônimos permanecem distintos; lançamentos sem centro em "Sem centro"; disponível em Personalizar Gráficos.

### 2026-09-03 — Correções 39
- Contratos vencidos deixam de manter imóveis ocupados quando não há outra locação não cancelada vigente; recálculo também nos indicadores do Resumo.

### 2026-10-06 — Relatórios consolidados
- Seletor **Empresas** para `SUPER_ADMIN`, consolidação por nome/tipo e agregações no banco (migration `20261006010000_reporting_indexes`).

### 2026-10-30 — Documentação inicial
- **Arquivos:** esta pasta. **Razão:** economizar leitura de código em futuras sessões.
