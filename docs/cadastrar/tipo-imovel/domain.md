# Tipo de imóvel — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### PropertyType
- Campos: description: String
- Relações: leases[] → Lease; properties[] → Property; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`PropertyType`, `CreatePropertyTypeData`, `UpdatePropertyTypeData`, `ListPropertyTypesParams`, `PaginatedPropertyTypes`

## Validação (Zod, `src/shared/validators`)
- createPropertyTypeSchema: description — property-type.ts
- updatePropertyTypeSchema: description? — property-type.ts
- listPropertyTypesQuerySchema: limit?, page?, search?, includeInactive? — property-type.ts

## Regras de negócio
- A descrição é única por empresa (`Este tipo de imóvel já existe`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- Tipo pode ser criado rapidamente no cadastro de imóveis (`quickCreateRecordAction`).
- Na consolidação de empresas os tipos são unidos pela descrição normalizada.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Tipo de imóvel não encontrado | crud.ts |
| ConflictError | Este tipo de imóvel já existe | crud.ts |
| NotFoundError | Tipo de imóvel não encontrado ou já excluído | crud.ts |
| ValidationError | O tipo de imóvel não está excluído | crud.ts |
