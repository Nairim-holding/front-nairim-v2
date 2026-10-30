# Empresas

Cadastro das empresas (tenants), identidade visual/tema (white label) e troca de empresa. Menu visível apenas para `SUPER_ADMIN`.

| Aspecto | Detalhe |
|---|---|
| Menu | Cadastrar > Empresa (somente SUPER_ADMIN) |
| Rota | `/dashboard/empresas` |
| Permissão | recurso `companies` (ver, criar, editar, excluir) |
| Modelos Prisma | `Company`, `CompanyBranding` |
| Server | `server/actions/company.ts`, `server/queries/company.ts` |
| Domínio | `core/use-cases/company/branding.ts`, `core/use-cases/company/crud.ts`, `core/use-cases/company/switch-company.ts`, `core/entities/company.ts`, `core/entities/company-access.ts` |
| Infra | `infra/repositories/prisma-companies-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Operações globais (listar, criar, editar, excluir empresas e trocar de empresa) exigem `SUPER_ADMIN` (`assertSuperAdmin`). Cada usuário edita só o branding da própria empresa.
2. `slug` é único e aparece na URL (`/<slug>/dashboard`); `Company` e `CompanyBranding` **não** são tenant-scoped.
3. Branding público por slug tem cache em memória de 60 s, invalidado em update e upload. Imagens: validação de tipo e tamanho (`ValidationError`). Cores aceitas por `isSafeBrandingColor`.
4. Tema: cada cor, nos modos claro e escuro, tem botão **Desfazer**; campo originalmente vazio volta a herdar o padrão; só aplica ao salvar. Se só há cores claras, os escuros são derivados (`lib/colorUtils.ts`).
5. `db_quota_mb` define a cota de banco mostrada no dashboard; nulo = sem limite.
6. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
