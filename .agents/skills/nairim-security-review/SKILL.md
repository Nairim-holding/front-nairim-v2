---
name: nairim-security-review
description: Revisar a segurança do Nairim quando solicitado, cobrindo autenticação, permissões, isolamento entre empresas, entradas e saídas, dependências e configuração de implantação.
---

Use esta skill para uma revisão de segurança do Nairim ou para investigar uma suspeita concreta. Não é requisito para alterações comuns de interface.

Comece pelo diff e pelos fluxos envolvidos. Trace a requisição desde Server Actions/Route Handlers até os repositórios e as conexões. Para uma revisão ampla, cubra estes pontos do projeto:

- Autenticação: `src/infra/auth/session.ts`, `live-session.ts`, JWT, cookies, rate limiter e revogação. Confira a sessão no servidor; proteção de menu não concede autorização.
- Empresa: `src/infra/database/prisma.ts`, `tenant-context.ts`, `reporting-context.ts` e `src/infra/auth/reporting-scope.ts`. Relatórios consolidados ampliam somente leituras autorizadas. Relações filhas sem `company_id` precisam da verificação do pai. Tente IDs de outra empresa nas ações alteradas.
- Entradas e saídas: schemas Zod, upload/importação, SQL bruto, URLs externas e HTML gerado. Tooltips ECharts recebem textos do banco; mantenha escape de cabeçalho, rótulos e valores e validação das cores.
- Infraestrutura declarada: `next.config.ts`, Dockerfile, Compose e workflows; confira superfície pública, cache de dados autenticados, usuário do container e limites de upload. Não presuma que os arquivos locais comprovam firewall, TLS, permissões, backups ou conexões da VPS.
- Dependências: execute `npm audit --json`, diferencie aplicação e ferramentas de desenvolvimento e confirme os avisos nos mantenedores. Prefira atualizações compatíveis, validadas pelos testes. Não aplique `--force` nem downgrade de PWA para simplesmente zerar contagens.

Use `npm run test:security` para regressões de sessão, permissão, tenant e HTML; complemente com um teste que reproduza cada falha encontrada. Execute `npm test`, build e os testes de interface afetados após as correções. Os testes simulados não comprovam as configurações efetivas de produção.

Documente os achados com caminho, entrada, impacto, correção, evidência e pendências. Registre a data e a contagem do audit, sem equiparar vulnerabilidade de pacote a exploração demonstrada. Use `docs/plataforma/seguranca/revisao-2026-10-25.md` como histórico inicial e `docs/correcoes-51-2026-10-21.md` para a implantação da sequência do extrato.
