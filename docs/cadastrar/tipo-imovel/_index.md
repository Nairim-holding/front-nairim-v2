# Tipo de imóvel

Cadastro simples dos tipos de imóvel (casa, apartamento, sala comercial etc.) usados nos imóveis, filtros e gráficos.

| Aspecto | Detalhe |
|---|---|
| Menu | Cadastrar > Tipo Imóvel |
| Rota | `/dashboard/tipo-imovel` |
| Permissão | recurso `property-types` (ver, criar, editar, excluir) |
| Modelos Prisma | `PropertyType` |
| Server | `server/actions/property-type.ts`, `server/queries/property-type.ts` |
| Domínio | `core/use-cases/property-type/crud.ts`, `core/entities/property-type.ts` |
| Infra | `infra/repositories/prisma-property-types-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. A descrição é única por empresa (`Este tipo de imóvel já existe`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
2. Tipo pode ser criado rapidamente no cadastro de imóveis (`quickCreateRecordAction`).
3. Na consolidação de empresas os tipos são unidos pela descrição normalizada.
