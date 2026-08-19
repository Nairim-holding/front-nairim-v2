# Passo a passo — Correções e Ajustes Sistema Nairim (15/08/2026)

## Instruções gerais para o Claude Code (ler antes de começar)

- **Não presuma nenhuma tecnologia, framework, biblioteca ou arquitetura.** Antes de executar qualquer tarefa, explore o repositório atual (estrutura de pastas, arquivos de configuração, dependências instaladas, padrões de nomenclatura, componentes e serviços já existentes) para entender como o sistema foi construído e replicar os mesmos padrões.
- Cada tarefa abaixo é independente. Execute uma de cada vez, na ordem apresentada (ou na ordem que fizer mais sentido após analisar o repositório), e valide antes de seguir para a próxima.
- Sempre que uma tarefa mencionar uma imagem de referência, ela está disponível na pasta `imagens_referencia/` (nomes de arquivo indicados entre parênteses). Use as imagens apenas como referência visual/funcional do comportamento esperado — não como especificação de tecnologia.
- Antes de implementar, localize no repositório as telas, componentes, rotas, serviços e consultas que já implementam a funcionalidade descrita, para alterar o comportamento existente em vez de recriar algo do zero.
- Ao final de cada tarefa, rode os testes/lint/build já configurados no projeto (o que existir) para garantir que nada quebrou.
- Sempre que houver dúvida sobre um comportamento descrito, implemente a interpretação mais conservadora (que não quebra o que já funciona) e deixe um comentário/observação sobre o ponto de dúvida.

---

## Tarefa 1 — Financeiro

### 1.1 Atualização do valor do lançamento
Hoje, ao alterar o valor de um lançamento parcelado/recorrente ou originado de locações, o sistema pergunta se o usuário deseja propagar a alteração para os próximos lançamentos — mas isso só acontece quando o status do lançamento é **Concluído**.

**Ajuste:** faça essa mesma pergunta/recurso funcionar também quando o status do lançamento for **Pendente**. Localize a lógica atual que restringe esse comportamento ao status "Concluído" e remova/ajuste essa restrição para incluir "Pendente".

### 1.2 Botão "Exportar para o Excel"
Atualmente a exportação traz todos os valores em uma única coluna, sem diferenciar créditos de débitos, o que dificulta a leitura e o uso de fórmulas (ex.: soma automática).

**Ajuste:**
- Lançamentos do tipo **Despesa** devem ser exportados com o valor em **negativo** e, se possível, em **cor vermelha** (ex.: `R$ -61,70`), para diferenciar visualmente créditos e débitos.
- Avalie também a alternativa de ter **duas colunas separadas** (uma para valores a Crédito e outra para valores a Débito) e implemente a opção que for mais viável dentro do que o repositório já suporta para geração de planilhas.
- Referência visual do problema atual e do resultado esperado: `01-financeiro-excel-icone-autosoma.png`, `02-financeiro-excel-exemplo-a.png`, `03-financeiro-excel-exemplo-b.png`.

### 1.3 Erro ao duplicar lançamento
Está ocorrendo erro ao duplicar um lançamento na tela do Financeiro.

**Ajuste:** investigue e corrija a rotina de duplicação de lançamento no Financeiro, reproduzindo o erro localmente antes de corrigir.

### 1.4 Filtros nas Locações
Os campos de filtro em Locações perderam conteúdo/comportamento que existia antes.

**Ajuste:** restaure o correto funcionamento dos filtros de:
- **Status**
- **Condição de Pagamento**

Depois disso, **verifique também os filtros dos demais cadastros do sistema**, garantindo que todos estejam preenchendo/funcionando corretamente (não só Locações).

---

## Tarefa 2 — Gráfico "Localização dos imóveis"
Referência visual: `04-grafico-localizacao-icone.png`, `05-grafico-localizacao-filtro.png`.

**Ajustes:**
- Exibir os alfinetes (marcadores) no mapa **independentemente do ano de locação**.
- Se o imóvel estiver **locado**, o alfinete deve aparecer na cor **roxa**.
- Se o imóvel estiver **disponível para locação**, o alfinete deve aparecer na cor **vermelha**.
- O filtro deve funcionar **independentemente do período de análise selecionado**.
- Quando um período de análise for informado, o mapa deve trazer os imóveis locados **naquele período**.
- Por padrão (sem período selecionado), deve trazer **todos** os imóveis.

---

## Tarefa 3 — Portfólio

### 3.1 Consumo de Banco de Dados (MB)
Referência visual: `06-portfolio-consumo-bd-velocimetro-a.png`, `07-portfolio-consumo-bd-velocimetro-b.png`.

**Ajustes:**
- O indicador de MB no velocímetro está sendo ocultado — corrigir para que fique sempre visível.
- Por padrão, todos os anos/meses devem vir **selecionados**, mostrando o total geral. O usuário só deve precisar mexer no período de análise se quiser filtrar por ano/mês específico.

### 3.2 Espaço de Anexos (MB)
Mesmo comportamento problemático do item anterior:
- O indicador de MB no velocímetro está sendo ocultado — corrigir.
- Por padrão, todos os anos/meses devem vir selecionados, mostrando sempre o total.

---

## Tarefa 4 — Auditoria

### 4.1 Auditoria de IPTU
Referência visual: `08-auditoria-iptu-config.png`, `09-auditoria-iptu-grafico-errado.png`, `10-auditoria-grafico-estilo-cartao.png`, `11-auditoria-filtro-a.png`, `12-auditoria-filtro-b.png`.

**Problema atual:** mesmo com a configuração da auditoria feita corretamente, o sistema está considerando apenas um ou dois imóveis, e o gráfico gerado está incorreto.

**O que precisa existir:**
- Corrigir a apuração para considerar **todos os imóveis configurados** na auditoria, não só um ou dois.
- Corrigir o gráfico da Auditoria de IPTU.
- Criar uma visão comparativa, por mês ou por ano, entre:
  - o **pagamento do IPTU pela empresa**, e
  - a **restituição do IPTU pelos inquilinos**,
  
  para permitir identificar se os repasses de restituição estão corretos ou se há prejuízo para a empresa.
- A tela deve permitir selecionar o **ano** de análise.
- Deve existir uma tabela/lista com as colunas: **Detalhe (botão de expandir), Nome Fantasia do Imóvel, Endereço, Receitas, Despesas, Saldo**, com uma linha de **Totais** ao final.
- Ao clicar no botão de detalhe (+) de uma linha, deve exibir, abaixo dela, os **lançamentos financeiros** que geraram os valores de Despesas e Receitas daquele imóvel.
- Incluir um **gráfico de barras verticais** (no mesmo estilo do gráfico já usado nos Cartões de Crédito do sistema), com uma barra por imóvel, mostrando Receita e Despesa em tons de cor diferentes (mais escuro/mais claro).
- Incluir um **filtro** para selecionar um ou mais imóveis a serem considerados na Auditoria.

### 4.2 Retorno sobre o Investimento do imóvel (ROI)
**Necessidade:** mostrar, por imóvel, um comparativo entre:
- o valor pago na aquisição do imóvel,
- o quanto ele já rendeu em locações,
- o quanto já gerou de gastos (manutenções e outros),

de forma a indicar a situação financeira de cada imóvel e uma previsibilidade de quando ele será "quitado" e passará a gerar lucro.

Essas informações devem ser extraídas dos lançamentos financeiros, de acordo com Categorias e Subcategorias configuráveis. É necessário criar uma tela de parametrização para que o usuário defina quais categorias/subcategorias entram em cada cálculo, e o processamento precisa ser em tempo real, sem impacto perceptível de performance.

> Este item é o mais aberto/exploratório do documento — antes de implementar, proponha uma abordagem (pode envolver pré-cálculo/cache dos totais, por exemplo) e valide com o usuário antes de seguir, já que ele mesmo está aberto a sugestões de solução.

---

## Tarefa 5 — Impressão de relatórios e geração de PDF (Financeiro)

### 5.0 Menu Financeiro
- Adicionar um separador visual no menu do Financeiro para diferenciar as opções de manutenção das opções de relatórios.
- Na opção "Descrição", exibir a **descrição completa** no gráfico (hoje aparece cortada/parcial). Aplicar a mesma correção nas Receitas.

### 5.1 Cabeçalho dos relatórios
Referência visual: `13-relatorios-cabecalho-errado-adiplan.png`.

**Problema:** os relatórios estão exibindo os dados da imobiliária "Adiplan" no cabeçalho.

**Ajuste:** corrigir para que todos os relatórios usem os dados da empresa **Nairim** (a empresa correta configurada para o cliente).

### 5.2 Total Geral nos relatórios
Referência visual: `14-relatorios-total-geral.png`.

**Ajuste:** ao final de cada relatório, incluir uma linha de **Total Geral** com o valor acumulado do item de menu selecionado. Essa linha deve ter cor de fundo destacada e texto em negrito.

Aplicar esse total em **todos** os relatórios de Despesas e Receitas, em cada uma das seguintes visões:
- Por Descrição
- Por Dia
- Por Tipo
- Por Categoria
- Pago a...
- Por Centro de Despesa

E replicar o mesmo comportamento para as **Receitas**.

### 5.3 Relatório Extrato (Fluxo de Caixa)
Referência visual: `15-extrato-fluxo-caixa-a.png`, `16-extrato-fluxo-caixa-b.png`.

**Ajuste:** incluir no relatório o **Saldo Anterior** referente ao período selecionado.

### 5.4 Relatório Demonstrativo (Fluxo de Caixa)
Referência visual: `17-demonstrativo-mensagem-erro.png`, `18-demonstrativo-selecao-e-resultado.png`.

**Problemas relatados:**
- O relatório exibe uma mensagem de erro/aviso que não corresponde a nenhum lançamento encontrado — investigar a origem dessa mensagem e corrigir ou torná-la compreensível.
- Em um teste com Instituição = BB, Período = mês de julho, Agrupar = por dia, havia lançamentos em Impostos, Despesas Fixas e Pessoas, mas o relatório não os considerou corretamente — **está considerando apenas as Receitas**, ignorando as Despesas.

**Ajuste:** corrigir a lógica de geração desse relatório para considerar corretamente Receitas e Despesas conforme os filtros selecionados (Instituição, Período, Agrupamento).

---

## Tarefa 6 — Menu do sistema
Referência visual: `19-menu-sistema-modelo-referencia.png`, `20-menu-sistema-aberto.png`.

**Situação atual:** o menu lateral vertical do sistema Nairim está com um preenchimento sólido/chapado na cor roxa.

**Ajuste:** revisar o visual do menu para seguir o estilo de um sistema de referência já existente (usado como modelo pelo cliente), que possui:
- Bordas visíveis, com cor interna mais clara.
- Uma logo do sistema e um seletor para abrir/encolher o menu.
- Ao encolher, o menu deve desaparecer de forma animada, deixando visível apenas o seletor de acionamento e a logo.
- Ao encolher/expandir, o conteúdo da tela deve se reposicionar (empurrar para a direita ao abrir o menu, ocupar o espaço extra ao encolher).

> Caso reste dúvida sobre o comportamento exato da animação, descreva a interpretação adotada para validação com o usuário — ele mencionou poder demonstrar pessoalmente se necessário.

---

## Tarefa 7 — Auditoria / Logs

### 8.1 Tela inicial — paginação
Referência visual: `22-auditoria-logs-paginacao.png`, `23-rodape-padrao-financeiro.png`.

**Problema:** a paginação de registros foi alterada e não deveria ter sido. O padrão anterior era de opções como **30 — 50 — 150**, valor padrão de **150 registros**. Atualmente está trazendo 100 como padrão nas telas afetadas, e 30 registros como padrão em outros cadastros do sistema.

**Ajuste:**
- Restaurar as opções de paginação como eram antes (30 — 50 — 150) na tela de Logs/Auditoria e na tela de Lançamentos do Financeiro.
- Definir **150** como quantidade padrão de registros nessas telas.
- Em **todos os cadastros do sistema**, ajustar para que o padrão também seja **150 registros** (hoje está em 30).
- Ajustar o rodapé de paginação dessas telas para seguir o **mesmo padrão visual** já usado na tela de Lançamentos do Financeiro (imagem de referência do rodapé padrão).

### 8.2 Colunas da tela de Logs

**IP de Origem:** os dados exibidos hoje não fazem sentido para o usuário.
- Se o dado exibido for IPv6, ajustar o cabeçalho da coluna para deixar isso claro.
- Se for IPv4, exibir o IP corretamente formatado.

**Coluna "Registro":**
- Investigar o que esse campo representa (aparentemente é o ID do lançamento na tabela) e, se fizer sentido, exibir uma informação amigável ao usuário nesse lugar; caso não seja possível tornar compreensível, ocultar ou remover essa coluna.

**Logs de Inclusão, Alteração e Exclusão — campos amigáveis:**
Hoje os logs mostram IDs técnicos em vez de descrições legíveis. Ajustar para exibir a descrição/nome correspondente em vez do ID técnico, nos seguintes campos (exemplos ilustrativos extraídos do documento original):
- **Centro** → exibir a descrição do centro (em vez do ID/UUID).
- **Empresa** → exibir o nome da empresa (em vez do ID/UUID).
- **Criado em** → exibir em formato amigável `dd-mm-aaaa — hh:mm:ss` (em vez do formato ISO `2026-08-15T12:53:24.444Z`).
- **Data do Evento** → exibir em formato amigável `dd-mm-aaaa` (em vez do formato ISO).
- **Categoria** → exibir a descrição da categoria (em vez do ID/UUID).
- **Fornecedor** → renomear o rótulo para **Contato** e exibir o nome do contato (em vez do ID/UUID).
- **Data Efetiva** → exibir em formato amigável `dd-mm-aaaa`, posicionada logo abaixo do campo "Data do Evento".
- **Subcategoria** → exibir a descrição da subcategoria (em vez do ID/UUID), posicionada logo abaixo do campo "Categoria".
- **Instituição Financeira** → exibir o nome da instituição (em vez do ID/UUID).

**Ordem sugerida das colunas:** seguir a mesma sequência/ordem de campos já adotada na tela de Lançamentos do Financeiro (pode ser exibida em múltiplas linhas, uma informação abaixo da outra, desde que respeite essa sequência).

**Campos internos de controle:** se estiverem nulos, não exibir; se tiverem valor, posicioná-los após o último campo da sequência dos lançamentos (que hoje é o campo "Status").

---

## Tarefa 8 — Erro interno ao acessar o sistema
Referência visual: `24-erro-interno-acesso-sistema.png` (erro ocorrido em 15/08/2026 às 15:56).

**Ajuste:** investigar a causa desse erro interno (analisar logs de aplicação/servidor do período informado) e corrigir a causa raiz. Caso não seja possível reproduzir localmente, adicionar tratamento de erro e log mais claro nesse ponto do sistema para facilitar o diagnóstico em uma próxima ocorrência, e documentar o motivo identificado para explicação ao usuário.

---

## Checklist de execução sugerida para o Claude Code

1. Analisar a estrutura do repositório (stack, padrões, camadas de dados, componentes de UI, geração de relatórios/exportação) antes de tocar em qualquer código.
2. Executar as tarefas 1 a 9 uma a uma, na ordem acima (ajustando a ordem apenas se a análise do repositório indicar dependência técnica entre elas).
3. Para cada tarefa, localizar o código responsável pelo comportamento atual antes de alterar.
4. Validar visualmente o resultado comparando com as imagens de referência quando existirem.
5. Rodar os testes automatizados e o build do projeto (o que já existir configurado) após cada tarefa.
6. Sinalizar claramente qualquer ponto em que a tarefa 4.2 (ROI) ou a tarefa 6 (menu do sistema) precisar de validação do usuário antes de prosseguir, conforme observado no próprio documento original.
