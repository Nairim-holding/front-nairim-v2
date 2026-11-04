# Empresas — Telas

## `/dashboard/empresas/cadastrar` — Identificação
Arquivo: `src/app/dashboard/empresas/cadastrar/page.tsx` (234 linhas)
- Campos do formulário: Nome interno (identificação no sistema), Slug (URL: /slug/login), Limite de banco de dados (MB), Nome exibido na interface, Nome fantasia, Título da aplicação (aba do navegador), Descrição (meta description / compartilhamento)
- Componentes: `form/DynamicForm`, `admin/WhiteLabel/themeFields`, `protections/SuperAdminOnly`

## `/dashboard/empresas/editar/[id]` — Identificação
Arquivo: `src/app/dashboard/empresas/editar/[id]/page.tsx` (320 linhas)
- Campos do formulário: Nome interno, Slug (URL: /slug/login), Limite de banco de dados (MB), Empresa ativa, Nome exibido na interface, Nome fantasia, Título da aplicação (aba do navegador), Descrição (meta description / compartilhamento)
- Componentes: `form/DynamicForm`, `admin/WhiteLabel/themeFields`, `admin/WhiteLabel/AssetUploader`, `protections/SuperAdminOnly`

## `/dashboard/empresas`
Arquivo: `src/app/dashboard/empresas/page.tsx` (34 linhas)
- Colunas da lista: Nome, Slug, Ativo, Criado em
- Componentes: `layout/PageSection`, `table/DataTable`, `table/TableSkeleton`, `protections/SuperAdminOnly`

## `/dashboard/empresas/visualizar/[id]` — Identificação
Arquivo: `src/app/dashboard/empresas/visualizar/[id]/page.tsx` (180 linhas)
- Campos do formulário: Nome interno, Slug (URL: /slug/login), Empresa ativa
- Outros rótulos: Endereço
- Componentes: `form/DynamicForm`, `protections/SuperAdminOnly`, `admin/WhiteLabel/BrandingPreview`
