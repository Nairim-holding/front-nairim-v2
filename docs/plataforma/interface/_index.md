# Interface e navegação (menu, avisos e tema)

Comportamentos globais da interface, fora de um módulo de menu.

| Aspecto | Onde |
|---|---|
| Layout das telas autenticadas | `src/app/dashboard/layout.tsx`, `src/components/layout/DashboardShell` |
| Menu lateral | `src/components/layout/Sidebar/index.tsx` (itens por permissão; "Empresa" só `SUPER_ADMIN`) |
| Bloqueio de tela sem permissão | `src/components/layout/PermissionGate` e `ForbiddenNotice` |
| Providers globais | `src/app/providers.tsx` (Branding, Theme, Auth, Permissions, Popup, Message, Filter) |
| Avisos (toasts) | `src/contexts/MessageContext.tsx`, `src/components/feedback/Toast` |
| Tema e identidade visual | `src/contexts/ThemeContext.tsx`, `BrandingContext.tsx`, `src/lib/brandingCss.ts`; edição em `docs/cadastrar/empresas/` |

## Menu lateral
- Inicia **recolhido** quando não está fixado (ícone de alfinete). Navegar pela central de alertas ou abrir com o botão do meio recolhe o menu não fixado.
- Clique direito, Ctrl/Command/Shift mantêm o link e o menu visíveis, para o navegador oferecer "abrir em nova guia".
- Cada item aparece só se a sessão tem `view` no recurso (`resourceForHref`, `src/utils/permissionResource.ts`).
- O sino **Alertas de locações** abre um painel fora da área do menu, com altura pela janela e rolagem interna (ver `docs/locacoes/alertas-atrasos/`).
- Rodapé: alternância de tema claro/escuro e **Sair da conta**.

## Avisos (toasts)
Clicar em qualquer área do aviso pausa o tempo; outro clique retoma de onde parou. O botão Fechar funciona também durante a pausa.

## Tema
- Classes de tema seguem a seleção do sistema (claro/escuro), independente do tema do navegador.
- Cada empresa define cores nos dois modos; quando só há cores claras, os escuros são derivados.
- Telas de Centros usam laranja para Despesa e verde para Receita; as demais usam as cores da empresa.

## Seletores de busca
- O foco automático de campos de seleção não abre a lista quando já há valor; clique ou setas permitem trocar.
- Seleção de imóvel pesquisa por nome ignorando acentos (`SearchInput`, `QuickCreateAutocomplete`).
- Campos de data aceitam apagar com as barras sem seleção manual.

## Histórico
### 2026-10-19 — Correções 50
Painel do sino fora da área do menu com altura pela janela; clique direito mantém link e menu.

### 2026-10-17 — Correções 49
Pausa de aviso por clique; menu inicia recolhido; cores laranja/verde na manutenção de centros.

### 2026-10-21 — Correções 51
Menu mantém o menu nativo para nova aba; Ctrl/Command/Shift também mantêm o menu aberto.

### 2026-09-03 — Modo escuro
Classes de tema pela seleção do sistema e logomarca escura.

### 2026-10-30 — Documentação inicial
