# Proprietários — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Owner
- Campos: name: String; internal_code: String; occupation: String?; marital_status: String?; cpf: String?; cnpj: String?; municipal_registration: String?; state_registration: String?
- Relações: contacts[] → Contact; leases[] → Lease; addresses[] → OwnerAddress; properties[] → Property; company → Company
- Únicos compostos: company_id, internal_code
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### OwnerAddress
- Campos: owner_id: String; address_id: String
- Relações: address → Address; owner → Owner
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`OwnerContactInput`, `OwnerAddressInput`, `Owner`, `CreateOwnerData`, `UpdateOwnerData`, `ListOwnersParams`, `PaginatedOwners`

## Validação (Zod, `src/shared/validators`)
- createOwnerSchema — owner.ts
- updateOwnerSchema: name?, internal_code?, occupation, marital_status, cpf, cnpj, state_registration, municipal_registration, contacts?, addresses? — owner.ts
- listOwnersQuerySchema: limit?, page?, search?, includeInactive? — owner.ts

## Regras de negócio
- Código interno, CPF e CNPJ únicos por empresa (`ConflictError`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- O cadastro começa pela escolha do tipo (`?tipo=fisica|juridica`); sem tipo válido a tela volta à lista.
- Código interno gerado automaticamente; proprietário pode ser criado no cadastro de imóvel com dados provisórios (`RAP...`).
- Contatos e endereços são tabelas filhas sem `company_id` próprio; o isolamento vem do proprietário.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Proprietário não encontrado | crud.ts |
| ConflictError | O Código Interno informado já está em uso por outro proprietário | crud.ts |
| ConflictError | O CPF informado já está cadastrado | crud.ts |
| ConflictError | O CNPJ informado já está cadastrado | crud.ts |
| ConflictError | O CPF informado já está cadastrado para outro proprietário | crud.ts |
| ConflictError | O CNPJ informado já está cadastrado para outro proprietário | crud.ts |
| NotFoundError | Proprietário não encontrado ou já excluído | crud.ts |
| ValidationError | O proprietário não está excluído | crud.ts |
