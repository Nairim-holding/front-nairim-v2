# Documentação do Nairim

Organizada **por módulo, na ordem do menu lateral**. Comece pelo `_index.md` da pasta do módulo (1 minuto de leitura) e vá aos outros arquivos só se precisar. Para criar ou atualizar, siga `.agents/skills/docs/SKILL.md`.

Cada pasta de módulo tem: `_index.md` (sumário), `domain.md`, `actions.md`, `queries.md`, `telas.md`, `patterns.md`, `changelog.md` e, quando o assunto pede, arquivos extras.

## Resumo
- [Resumo (dashboard)](resumo/_index.md) — abas Financeiro, Portfólio, Clientes e Mapa; [widgets](resumo/widgets.md), [filtros](resumo/filtros.md), [consolidação de empresas](resumo/consolidacao-de-empresas.md)

## Cadastrar
| Módulo | Rota | Pasta |
|---|---|---|
| Usuários | `/dashboard/administradores` | [cadastrar/usuarios](cadastrar/usuarios/_index.md) |
| Grupo de Usuário | `/dashboard/grupos-usuario` | [cadastrar/grupos-usuario](cadastrar/grupos-usuario/_index.md) |
| Empresa (SUPER_ADMIN) | `/dashboard/empresas` | [cadastrar/empresas](cadastrar/empresas/_index.md) |
| Imóvel | `/dashboard/imoveis` | [cadastrar/imoveis](cadastrar/imoveis/_index.md) · [localização](cadastrar/imoveis/localizacao.md) |
| Imobiliária | `/dashboard/imobiliarias` | [cadastrar/imobiliarias](cadastrar/imobiliarias/_index.md) |
| Inquilinos | `/dashboard/inquilinos` | [cadastrar/inquilinos](cadastrar/inquilinos/_index.md) |
| Proprietários | `/dashboard/proprietarios` | [cadastrar/proprietarios](cadastrar/proprietarios/_index.md) |
| Tipo Imóvel | `/dashboard/tipo-imovel` | [cadastrar/tipo-imovel](cadastrar/tipo-imovel/_index.md) |
| Índices de Reajuste | `/dashboard/indices-reajuste` | [cadastrar/indices-reajuste](cadastrar/indices-reajuste/_index.md) |

## Locações
| Módulo | Rota | Pasta |
|---|---|---|
| Locações | `/dashboard/locacoes` | [locacoes/locacoes](locacoes/locacoes/_index.md) |
| Alertas de atrasos | `/dashboard/locacoes/atrasadas` | [locacoes/alertas-atrasos](locacoes/alertas-atrasos/_index.md) |
| Relatórios | `/dashboard/locacoes/relatorios` | [locacoes/relatorios](locacoes/relatorios/_index.md) |

## Financeiro
| Módulo | Rota | Pasta |
|---|---|---|
| Instituições Financeiras | `/dashboard/instituicoes-financeiras` | [financeiro/instituicoes-financeiras](financeiro/instituicoes-financeiras/_index.md) |
| Categorias/Subcategorias | `/dashboard/categorias` | [financeiro/categorias](financeiro/categorias/_index.md) |
| Cartões de Crédito | `/dashboard/cartoes` | [financeiro/cartoes](financeiro/cartoes/_index.md) |
| Centros | `/dashboard/centros` | [financeiro/centros](financeiro/centros/_index.md) |
| Contatos | `/dashboard/fornecedores` | [financeiro/contatos](financeiro/contatos/_index.md) |
| Lançamentos | `/dashboard/lancamentos` | [financeiro/lancamentos](financeiro/lancamentos/_index.md) |
| Planejamento e Controle | `/dashboard/planejamento` | [financeiro/planejamento](financeiro/planejamento/_index.md) |
| Meus Investimentos | `/dashboard/investimentos` | [financeiro/investimentos](financeiro/investimentos/_index.md) · [rendimento](financeiro/investimentos/rendimento.md) |
| Relatórios | `/dashboard/relatorios` | [financeiro/relatorios](financeiro/relatorios/_index.md) |

## Reparos e Configurações
- [Reparos](reparos/_index.md) · [itens, profissionais e ativação](reparos/regras-itens-e-profissionais.md) — `/dashboard/reparos`
- [Configurações](configuracoes/_index.md) · [transferência de tabelas (JSON)](configuracoes/transferencia-de-tabelas.md) — `/dashboard/configuracoes`

## Auditoria
- [IPTU](auditoria/iptu/_index.md) — `/dashboard/financeiro-auditoria`
- [ROI](auditoria/roi/_index.md) · [origem dos valores](auditoria/roi/origem-dos-valores.md) — `/dashboard/roi`
- [Logs](auditoria/logs/_index.md) · [operação (MongoDB, worker, expurgo)](auditoria/logs/operacao.md) — `/dashboard/auditoria`

## Plataforma (transversal)
- [Autenticação e sessão](plataforma/autenticacao/_index.md)
- [Vitrine pública de imóveis](plataforma/vitrine-publica/_index.md)
- [Interface e navegação (menu, avisos, tema)](plataforma/interface/_index.md)
- [Segurança](plataforma/seguranca/_index.md) · [revisão 07/09/2026](plataforma/seguranca/revisao-2026-09-07.md) · [revisão 25/10/2026](plataforma/seguranca/revisao-2026-10-25.md)
- [Ambientes, deploy e validação](plataforma/ambientes/_index.md) · [seed do Teste 2](plataforma/ambientes/seed-teste2.md)

## Convenções
- Sem arquivos soltos em `docs/` (só este índice). Documento novo entra na pasta do módulo dele.
- Histórico de mudanças vai no `changelog.md` do módulo, mais recente primeiro.
- Nada de senhas, tokens, IPs de servidores ou dados reais de clientes.
