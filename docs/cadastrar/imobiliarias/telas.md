# Imobiliárias — Telas

## `/dashboard/imobiliarias/cadastrar`
Arquivo: `src/app/dashboard/(cadastro)/imobiliarias/cadastrar/page.tsx` (9 linhas)

## `/dashboard/imobiliarias/editar/[id]`
Arquivo: `src/app/dashboard/(cadastro)/imobiliarias/editar/[id]/page.tsx` (14 linhas)

## `/dashboard/imobiliarias` — Imobiliárias
Arquivo: `src/app/dashboard/(cadastro)/imobiliarias/page.tsx` (44 linhas)
- Colunas da lista: Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Inscrição Municipal, CRECI, CEP, UF, Cidade, Bairro, Endereço, Contato, Fone, Celular, E-mail, Ação
- Componentes: `layout/PageSection`, `table/DataTable`, `table/TableSkeleton`

## `/dashboard/imobiliarias/visualizar/[id]` — Dados da Imobiliária
Arquivo: `src/app/dashboard/(cadastro)/imobiliarias/visualizar/[id]/page.tsx` (157 linhas)
- Campos do formulário: Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Inscrição Municipal, CRECI, CEP, Rua, Número, Complemento, Bairro, Cidade, Estado, País, Lista de Contatos
- Componentes: `form/DynamicForm`, `domain/contacts/ContactManager`
