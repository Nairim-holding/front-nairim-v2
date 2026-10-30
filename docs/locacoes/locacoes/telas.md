# Locações — Telas

## `/dashboard/locacoes/cadastrar` — Dados da Locação
Arquivo: `src/app/dashboard/(cadastro)/locacoes/cadastrar/page.tsx` (651 linhas)
- Campos do formulário: Número do Contrato, Data de Início, Data de Término, Imóvel, Tipo do Imóvel, Proprietário, Inquilino, Imobiliária, Observações Gerais, Categoria do Imóvel, Subcategoria do Imóvel, Centro de Custo, Categoria de Comissão, Instituição Financeira, Valor do Aluguel, Índice de Reajuste, Valor do Condomínio, Valor do IPTU (Base), Taxas Extras, Desconto / Despesa, Comissão Imobiliária (%), Valor Comissão, Vencimento Aluguel, Vencimento IPTU, Vencimento Condomínio, Ano do Exercício (IPTU), Selecione o Método de Pagamento, Valor de Cobrança: À vista, Data de Vencimento (À vista), Valor de Cobrança: 1ª Parcela, Data de Vencimento: 1ª Parcela, Valor de Cobrança: 2ª Parcela (com desconto), Data de Vencimento: 2ª Parcela, Número de Parcelas (0 = sem IPTU), Nome da Seguradora, Tipo de Seguro, Apólice, Lista de Fiadores, Arquivos da Locação (ex.: contrato)
- Outros rótulos: Carregando imóveis..., Carregando inquilinos..., Nenhuma, Selecione..., Nenhum, À vista (com 15% de desconto), Parcelado na 2ª (com 10% de desconto), Parcelado (Livre)
- Componentes: `ui/QuickRecordField`, `ui/QuickCreateAutocomplete`, `form/DynamicForm`, `domain/guarantors/GuarantorManager`

## `/dashboard/locacoes/editar/[id]` — Dados da Locação
Arquivo: `src/app/dashboard/(cadastro)/locacoes/editar/[id]/page.tsx` (861 linhas)
- Campos do formulário: Número do Contrato, Data de Início, Data de Término, Imóvel, Tipo do Imóvel, Proprietário, Inquilino, Imobiliária, Observações Gerais, Categoria do Imóvel, Subcategoria do Imóvel, Centro de Custo, Categoria de Comissão, Instituição Financeira, Valor do Aluguel, Índice de Reajuste, Valor do Condomínio, Valor do IPTU (Base), Taxas Extras, Desconto / Despesa, Comissão Imobiliária (%), Valor Comissão, Vencimento Aluguel, Vencimento IPTU, Vencimento Condomínio, Ano do Exercício (IPTU), Selecione o Método de Pagamento Desta Locação, Valor de Cobrança: À vista, Data de Vencimento (À vista), Valor de Cobrança: 1ª Parcela, Data de Vencimento: 1ª Parcela, Valor de Cobrança: 2ª Parcela (com desconto), Data de Vencimento: 2ª Parcela, Número de Parcelas (0 = sem IPTU), Nome da Seguradora, Tipo de Seguro, Apólice, Lista de Fiadores, Data de Cancelamento, Valor da Multa, Outros Valores, Justificativa, Arquivos da Locação (ex.: contrato)
- Outros rótulos: Carregando imóveis..., Carregando inquilinos..., Nenhuma, Selecione..., Nenhum, À vista (com 15% de desconto), Parcelado na 2ª (com 10% de desconto), Parcelado (Livre)
- Componentes: `ui/QuickRecordField`, `ui/QuickCreateAutocomplete`, `form/DynamicForm`, `domain/guarantors/GuarantorManager`, `domain/leases/LeaseCancellationModal`, `domain/leases/LeaseFinancialHistoryModal/LeaseFinancialHistoryButton`

## `/dashboard/locacoes` — Locações
Arquivo: `src/app/dashboard/(cadastro)/locacoes/page.tsx` (42 linhas)
- Colunas da lista: Contrato, Status, Data Início, Data Final, Nome do Imóvel, Tipo Imóvel, Proprietário, Inquilino, Valor Aluguel, Valor Condomínio, Valor IPTU, Condição Pagamento, Valor Taxas Extras, Desconto / Despesa, Valor Comissão, Vencimento Aluguel, Vencimento IPTU, Vencimento Condomínio, Criado em, Ação
- Componentes: `layout/PageSection`, `table/TableSkeleton`

## `/dashboard/locacoes/visualizar/[id]` — Dados da Locação
Arquivo: `src/app/dashboard/(cadastro)/locacoes/visualizar/[id]/page.tsx` (699 linhas)
- Campos do formulário: Número do Contrato, Data de Início, Data de Término, Imóvel, Tipo do Imóvel, Proprietário, Inquilino, Imobiliária, Observações Gerais, Categoria do Imóvel, Subcategoria do Imóvel, Centro de Custo, Categoria de Comissão, Instituição Financeira, Valor do Aluguel, Valor do Condomínio, Valor do IPTU (Base), Taxas Extras, Desconto / Despesa, Comissão Imobiliária (%), Valor Comissão, Vencimento Aluguel, Vencimento IPTU, Vencimento Condomínio, Método de Pagamento Escolhido, Valor de Cobrança: À vista, Valor de Cobrança: 1ª Parcela, Valor de Cobrança: 2ª Parcela (com desconto), Número de Parcelas, Nome da Seguradora, Tipo de Seguro, Apólice, Lista de Fiadores, Data de Cancelamento, Valor da Multa, Outros Valores, Justificativa
- Outros rótulos: Carregando imóveis..., Carregando inquilinos...
- Componentes: `form/DynamicForm`, `domain/guarantors/GuarantorManager`, `domain/leases/LeaseFinancialHistoryModal/LeaseFinancialHistoryButton`
