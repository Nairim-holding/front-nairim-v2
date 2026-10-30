# Inquilinos

Cadastro de inquilinos (pessoa física ou jurídica) com endereço e contatos, vinculados às locações.

| Aspecto | Detalhe |
|---|---|
| Menu | Cadastrar > Inquilinos |
| Rota | `/dashboard/inquilinos` |
| Permissão | recurso `tenants` (ver, criar, editar, excluir) |
| Modelos Prisma | `Tenant`, `TenantAddress` |
| Server | `server/actions/tenant.ts`, `server/queries/tenant.ts` |
| Domínio | `core/use-cases/tenant/crud.ts`, `core/entities/tenant.ts` |
| Infra | `infra/repositories/prisma-tenants-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Código interno, CPF e CNPJ são únicos por empresa (`ConflictError`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
2. Profissão e Estado Civil têm obrigatoriedade indicada na inclusão; mensagens de validação em português.
3. Pode ser criado rapidamente a partir do cadastro e da edição de locações (`Adicionar novo`, exige `create` em inquilinos): código `RAP...`, documento fictício aleatório e "A informar" — revisar depois.
4. Contatos usam o componente `ContactManager` (tabelas `Contact` e `ContactChannel`).
