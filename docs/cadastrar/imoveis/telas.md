# Imóveis — Telas

## `/dashboard/imoveis/cadastrar`
Arquivo: `src/app/dashboard/(cadastro)/imoveis/cadastrar/page.tsx` (10 linhas)

## `/dashboard/imoveis/editar/[id]`
Arquivo: `src/app/dashboard/(cadastro)/imoveis/editar/[id]/page.tsx` (19 linhas)

## `/dashboard/imoveis` — Imóveis
Arquivo: `src/app/dashboard/(cadastro)/imoveis/page.tsx` (49 linhas)
- Colunas da lista: Nome, Proprietário, CEP, Endereço, Bairro, Cidade, UF, Tipo do imóvel, Disponibilidade, Quartos, Banheiros, Lavabos, Vagas na Garagem, Área Total (m²), Área Privativa (m²), Fachada, Mobiliado, Número de Andar, Inscrição fiscal, Observações, Ação
- Componentes: `layout/PageSection`, `table/DataTable`, `table/TableSkeleton`

## Formulário em etapas (cadastrar, editar e visualizar)
As páginas `cadastrar`, `editar/[id]` e `visualizar/[id]` só carregam as opções de seleção (`_lib/propertyData.ts`) e renderizam `PropertyCreateForm`, `PropertyEditForm` e `PropertyViewForm`. As etapas ficam em `_lib/propertySteps.tsx` (`DynamicForm` + `StepProgressBar`); a conversão para o payload da action está em `_lib/propertyTransform.ts` e o cadastro rápido em `_lib/propertyQuickCreate.ts`.

| Etapa | Campos |
|---|---|
| Dados do Imóvel | Nome Fantasia, Quartos, Banheiros, Lavabos, Vagas na Garagem, Número do Andar, Área Total, Área Edificada, Testada, Registro Fiscal, Proprietário, Tipo do imóvel, Imobiliária, Mobiliado, IRRF, Nº Cadastro, Observações |
| Endereço | CEP (preenche o endereço), Rua, Número, Complemento, Quadra, Lote, Bairro, Cidade, Estado, País, Latitude/Longitude (ocultas) e **Localização do imóvel** (mapa com pin; ver [localizacao.md](localizacao.md)) |
| Valores e Condições | Data da Compra, Valor do Imóvel (Compra), Valor Aluguel, Valor Condomínio, Valor IPTU (Base de Referência), Valor Venal, Previsão de Vacância (meses por ano), Status Atual (Disponível, Ocupado, Vendido), Encargos/Custos Extras, Observações e os seis vínculos financeiros (Categoria/Subcategoria Aluguel, Centro de Custo Crédito e Débito, Categoria/Subcategoria de Restituição de IPTU) |
| IPTU | Cotas de IPTU do imóvel |
| Mídias | Imagens e Vídeos, Matrícula, Registro, Escritura (documentos que tiram o imóvel da pendência de documentação no Resumo) |
| Dados da Venda | Data da Venda, Comprador, Valor da Venda, Observação, mídias e documentos da venda |

Proprietário, Tipo e Imobiliária aceitam **Adicionar novo** (cadastro rápido) quando o usuário tem `create` no cadastro correspondente. Na visualização os campos ficam somente leitura.

## `/dashboard/imoveis/visualizar/[id]`
Arquivo: `src/app/dashboard/(cadastro)/imoveis/visualizar/[id]/page.tsx` (19 linhas)
