# Segurança

Resumo das defesas do sistema e dos achados das revisões. Os relatórios completos estão nesta pasta:
- [revisao-2026-09-07.md](revisao-2026-09-07.md) — falhas críticas e altas corrigidas (troca de empresa, escalada de privilégios, backups, isolamento no Prisma, vínculos entre empresas, permissões no servidor).
- [revisao-2026-10-25.md](revisao-2026-10-25.md) — escape de HTML em tooltips, atualização de dependências, painel de cartões, limites e pendências de infraestrutura.

A revisão guiada por agente usa `.agents/skills/nairim-security-review/SKILL.md`. Regressões: `npm run test:security`.

## Defesas em vigor (confirmadas no código)
| Tema | Onde |
|---|---|
| Sessão JWT (HS256), validação de conta, grupo e horário a cada requisição | `src/infra/auth/session.ts`, `live-session.ts`, `access-schedule.ts` |
| Permissão por recurso/ação no servidor (`withPermission`); só `SUPER_ADMIN` tem bypass | `src/infra/auth/session.ts`, `src/shared/utils/menu-resources.ts` |
| Isolamento por empresa em toda leitura/escrita (`TENANT_MODELS`) e relatórios consolidados só leitura | `src/infra/database/prisma.ts`, `tenant-context.ts`, `reporting-context.ts` |
| Referências entre registros validadas contra a empresa | `src/infra/auth/tenant-references.ts` |
| Limitador de login: 5 falhas por conta | `src/infra/security/login-rate-limiter.ts` |
| Escape de HTML dos tooltips ECharts e validação de cores | `src/utils/echartsTooltip.ts`, `src/shared/validators/branding-color.ts` |
| Backup e restauração só `SUPER_ADMIN` (contém hashes de senha) | `src/server/actions/backup.ts` |
| Auditoria transacional sem credenciais nos snapshots | triggers do Postgres, `docs/auditoria/logs/` |

## Riscos residuais conhecidos
- Cookie `authToken` legível por JavaScript (coexistência com o backend legado); HttpOnly exige migrar os consumidores.
- Limitador de login em memória do processo; várias réplicas exigem armazenamento compartilhado.
- `next.config.ts` aceita imagens HTTPS de qualquer host; restringir exige inventariar origens.
- Limite de upload de 50 MB (restauração e documentos) não substitui restrições do proxy reverso.
- Configuração real da VPS (portas, TLS de PostgreSQL/MinIO/Mongo, rotação de segredos, restauração de backups) precisa de evidência do ambiente.

## Histórico
### 2026-10-25 — Revisão 51
Escape de HTML em tooltips, Next.js 16.4.3, Sharp 0.35.5, DOMPurify 3.4.17, ECharts 6.1.0, remoção de `@types/next-pwa`, testes de sessão/permissão/empresa e skill de revisão criada.

### 2026-09-07 — Revisão inicial
Seis falhas críticas e altas corrigidas com testes de regressão.

### 2026-10-30 — Documentação inicial
