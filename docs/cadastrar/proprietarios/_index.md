# Proprietários

Cadastro de proprietários (pessoa física ou jurídica) com endereço e contatos, vinculados aos imóveis.

| Aspecto | Detalhe |
|---|---|
| Menu | Cadastrar > Proprietários |
| Rota | `/dashboard/proprietarios` |
| Permissão | recurso `owners` (ver, criar, editar, excluir) |
| Modelos Prisma | `Owner`, `OwnerAddress` |
| Server | `server/actions/owner.ts`, `server/queries/owner.ts` |
| Domínio | `core/use-cases/owner/crud.ts`, `core/entities/owner.ts` |
| Infra | `infra/repositories/prisma-owners-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Código interno, CPF e CNPJ únicos por empresa (`ConflictError`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
2. O cadastro começa pela escolha do tipo (`?tipo=fisica|juridica`); sem tipo válido a tela volta à lista.
3. Código interno gerado automaticamente; proprietário pode ser criado no cadastro de imóvel com dados provisórios (`RAP...`).
4. Contatos e endereços são tabelas filhas sem `company_id` próprio; o isolamento vem do proprietário.
