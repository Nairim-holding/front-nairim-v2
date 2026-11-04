# Inquilinos — Telas

## `/dashboard/inquilinos/cadastrar` — Dados do Inquilino
Arquivo: `src/app/dashboard/(cadastro)/inquilinos/cadastrar/page.tsx` (380 linhas)
- Campos do formulário: Código Interno, Nacionalidade, CPF, RG, Órgão Expedidor, UF Expedidor, CNPJ, Inscrição Estadual, Inscrição Municipal, CEP, Rua, Número, Complemento, Bairro, Cidade, Estado, País, Lista de Contatos
- Outros rótulos: Profissão, Estado Civil, Solteiro(a), Casado(a), Separado(a) judicialmente, Divorciado(a), Viúvo(a)
- Componentes: `form/DynamicForm`, `domain/contacts/ContactManager`

## `/dashboard/inquilinos/editar/[id]` — Dados do Inquilino
Arquivo: `src/app/dashboard/(cadastro)/inquilinos/editar/[id]/page.tsx` (294 linhas)
- Campos do formulário: Nome/Razão Social, Código Interno, Nacionalidade, Profissão, Estado Civil, CPF, RG, Órgão Expedidor, UF Expedidor, CNPJ, Inscrição Estadual, Inscrição Municipal, CEP, Rua, Número, Complemento, Bairro, Cidade, Estado, País, Lista de Contatos
- Outros rótulos: Solteiro(a), Casado(a), Separado(a) judicialmente, Divorciado(a), Viúvo(a)
- Componentes: `form/DynamicForm`, `domain/contacts/ContactManager`

## `/dashboard/inquilinos` — Inquilinos
Arquivo: `src/app/dashboard/(cadastro)/inquilinos/page.tsx` (50 linhas)
- Colunas da lista: Nome, Pessoa, Código Interno, Nacionalidade, Profissão, Estado Civil, CPF, RG, CNPJ, Inscrição Estadual, Inscrição Municipal, CEP, UF, Cidade, Bairro, Endereço, Complemento, Contato, Fone, Celular, E-mail, Ação
- Componentes: `layout/PageSection`, `table/DataTable`, `table/TableSkeleton`

## `/dashboard/inquilinos/visualizar/[id]` — Dados do Inquilino
Arquivo: `src/app/dashboard/(cadastro)/inquilinos/visualizar/[id]/page.tsx` (214 linhas)
- Campos do formulário: Nome/Razão Social, Código Interno, Nacionalidade, Profissão, Estado Civil, CPF, RG, Órgão Expedidor, UF Expedidor, CNPJ, Inscrição Estadual, Inscrição Municipal, CEP, Rua, Número, Complemento, Bairro, Cidade, Estado, País, Lista de Contatos
- Componentes: `form/DynamicForm`, `domain/contacts/ContactManager`
