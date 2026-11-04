# Proprietários — Telas

## `/dashboard/proprietarios/cadastrar` — Dados do Proprietário
Arquivo: `src/app/dashboard/(cadastro)/proprietarios/cadastrar/page.tsx` (318 linhas)
- Campos do formulário: Código Interno, Profissão, Estado Civil, CPF, CNPJ, Inscrição Estadual, Inscrição Municipal, CEP, Rua, Número, Complemento, Bairro, Cidade, Estado, País, Lista de Contatos
- Outros rótulos: Solteiro(a), Casado(a), Separado(a) judicialmente, Divorciado(a), Viúvo(a)
- Componentes: `form/DynamicForm`, `domain/contacts/ContactManager`

## `/dashboard/proprietarios/editar/[id]` — Dados do Proprietário
Arquivo: `src/app/dashboard/(cadastro)/proprietarios/editar/[id]/page.tsx` (346 linhas)
- Campos do formulário: Nome/Razão Social, Código Interno, Profissão, Estado Civil, CPF, CNPJ, Inscrição Estadual, Inscrição Municipal, CEP, Rua, Número, Complemento, Bairro, Cidade, Estado, País, Lista de Contatos
- Outros rótulos: Solteiro(a), Casado(a), Separado(a) judicialmente, Divorciado(a), Viúvo(a)
- Componentes: `form/DynamicForm`, `domain/contacts/ContactManager`

## `/dashboard/proprietarios` — Proprietários
Arquivo: `src/app/dashboard/(cadastro)/proprietarios/page.tsx` (48 linhas)
- Colunas da lista: Nome, Pessoa, Código Interno, Profissão, Estado Civil, CNPJ, CPF, Inscrição Estadual, Inscrição Municipal, CEP, UF, Cidade, Bairro, Endereço, Complemento, Contato, Fone, Celular, E-mail, Ação
- Componentes: `layout/PageSection`, `table/DataTable`, `table/TableSkeleton`

## `/dashboard/proprietarios/visualizar/[id]` — Dados do Proprietário
Arquivo: `src/app/dashboard/(cadastro)/proprietarios/visualizar/[id]/page.tsx` (179 linhas)
- Campos do formulário: Nome/Razão Social, Código Interno, Profissão, Estado Civil, CPF, CNPJ, Inscrição Estadual, Inscrição Municipal, CEP, Rua, Número, Complemento, Bairro, Cidade, Estado, País, Lista de Contatos
- Componentes: `form/DynamicForm`, `domain/contacts/ContactManager`
