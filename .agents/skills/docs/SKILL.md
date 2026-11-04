---
name: module-docs
description: Documenta um módulo do Nairim (uma tela/área do menu lateral) em docs/<grupo>/<modulo>/, com sumário, domínio, actions, queries, telas, padrões e histórico. Use para criar ou atualizar a documentação em docs/ e para ler um módulo sem reler o código.
---

## Objetivo
Manter `docs/` organizada **por módulo, na ordem do menu lateral**, para que a próxima sessão leia 1 arquivo (`_index.md`) em vez do código. Não existem arquivos soltos em `docs/`: tudo fica dentro da pasta de um módulo. A única exceção é `docs/README.md`, o índice.

## Estrutura de `docs/`
```
docs/
├── README.md                         índice de todos os módulos
├── resumo/                           Resumo (dashboard) — tem extras: widgets.md, filtros.md
├── cadastrar/<modulo>/               usuarios, grupos-usuario, empresas, imoveis, imobiliarias,
│                                     inquilinos, proprietarios, tipo-imovel, indices-reajuste
├── locacoes/<modulo>/                locacoes, alertas-atrasos, relatorios
├── financeiro/<modulo>/              instituicoes-financeiras, categorias, cartoes, centros,
│                                     contatos, lancamentos, planejamento, investimentos, relatorios
├── reparos/
├── configuracoes/
├── auditoria/<modulo>/               iptu, roi, logs
└── plataforma/<tema>/                transversais: autenticacao, vitrine-publica, interface, seguranca, ambientes
```
Cada pasta de módulo tem estes arquivos (nomes fixos):
```
_index.md      sumário executivo (máx. ~1 KB)
domain.md      modelos Prisma, entidades, regras de negócio e erros (~3 KB; até ~8 KB em módulos com modelos grandes, como Lançamentos)
actions.md     Server Actions: assinatura, validação, permissão (máx. ~3 KB)
queries.md     leituras para Server Components (máx. ~2 KB)
telas.md       rotas, colunas das listas, campos dos formulários, componentes (máx. ~3 KB)
patterns.md    trechos reais para copiar (máx. ~2 KB)
changelog.md   histórico por data, mais recente primeiro
```
Módulo com assunto extra (ex.: operação dos logs, regras do ROI) pode ter um arquivo adicional com nome descritivo, listado no `_index.md`.

Temas transversais em `plataforma/` sem código próprio (`ambientes`, `interface`, `seguranca`) usam só `_index.md` (com o histórico dentro dele) mais os documentos de apoio.

## De onde vem cada informação (caminhos reais do projeto)
| Doc | Fonte |
|---|---|
| domain | `prisma/schema.prisma` (modelos), `src/core/entities/<m>.ts`, `src/core/use-cases/<m>/` (regras e `throw new ...Error`), `src/shared/validators/<m>.ts` |
| actions | `src/server/actions/<m>.ts` (`'use server'`; permissão via `withPermission`/`withPermissionInput`) |
| queries | `src/server/queries/<m>.ts` (`'server-only'`) |
| telas | `src/app/dashboard/**/page.tsx` do módulo, `src/components/**` usados, colunas `ColumnDef` e `label:` dos formulários |
| permissões | chave em `src/shared/utils/menu-resources.ts` e rota em `src/utils/permissionResource.ts` |
| histórico | `git log -- <arquivos do módulo>` e as correções antigas (hoje em `changelog.md` de cada módulo) |

A arquitetura em camadas está descrita em `.agents/skills/nairim-project-structure/SKILL.md`; não repita isso nos módulos, só aponte para os arquivos.

## Formato de cada arquivo
**_index.md**: 1 linha dizendo o que é o módulo; tabela com rota, item do menu, recurso de permissão (`users`, `leases`...), modelos Prisma e arquivos-chave por camada; links para os outros arquivos; lista "Para mexer neste módulo, saiba que..." com 3–6 regras que mais causam erro.

**domain.md**: por modelo, campos relevantes (nome: tipo, obrigatoriedade), relações, `@@unique`; invariantes e regras de negócio com o arquivo onde estão; tabela de erros (classe, mensagem, quando ocorre).

**actions.md**: uma linha por action com `nome(args) → retorno`, permissão (`recurso:ação`), schema Zod e efeito (cria, edita, exclui, restaura, importa). Sem colar o corpo da função.

**queries.md**: uma linha por query com retorno, filtros (ex.: `deleted_at: null`, escopo de empresa), paginação e ordenação padrão.

**telas.md**: rotas (`/dashboard/...`), o que a tela faz, colunas da lista, campos do formulário por etapa, filtros, ações da linha, componentes de `src/components` usados.

**patterns.md**: snippets **reais** copiados do módulo (action, chamada no cliente, query no servidor), com o caminho de origem. Pegadinhas do módulo entram aqui.

**changelog.md**: `### AAAA-MM-DD — título`, depois **Arquivos**, **Razão** e **Impacto**, mais recente primeiro. Atualize sempre que mexer no módulo.

## Passos
1. Identifique o módulo no menu (`src/components/layout/Sidebar/index.tsx`) e o recurso em `menu-resources.ts`.
2. Liste os arquivos do módulo: `git ls-files | grep -i <nome>` em `server/actions`, `server/queries`, `core/use-cases`, `core/entities`, `shared/validators`, `infra/repositories`, `app/dashboard` e `components`.
3. Leia só o necessário: assinaturas e permissões das actions/queries, campos do schema Prisma, mensagens de erro dos use-cases, colunas e campos das telas.
4. Escreva os arquivos na pasta do módulo, respeitando os limites de tamanho.
5. Se o assunto já estava documentado em outro lugar de `docs/`, **reaproveite o conteúdo** na pasta certa e apague o arquivo antigo.
6. Adicione o módulo ao índice `docs/README.md` e registre a entrada inicial no `changelog.md`.

## Regras absolutas
1. **Sem arquivos soltos** em `docs/` (só `README.md`).
2. **Sem especulação:** só o que se confirma no código. Se não souber, escreva "não confirmado" e o arquivo a verificar.
3. **Concisão:** uma linha por action/query/campo; nada de colar código inteiro.
4. **Caminhos reais** (`src/...`) e nomes exatos de funções, para quem buscar com grep.
5. **Sem dados sensíveis:** nada de senhas, tokens, IPs de servidores, nomes de clientes ou registros reais de produção.
6. Atualize o `changelog.md` do módulo sempre que alterar o código dele.
