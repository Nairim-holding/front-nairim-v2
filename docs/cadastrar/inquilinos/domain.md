# Inquilinos — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Tenant
- Campos: name: String; internal_code: String; nationality: String?; occupation: String?; marital_status: String?; cpf: String?; rg: String?; rg_issuing_body: String?; rg_issuing_state: String?; cnpj: String?; municipal_registration: String?; state_registration: String?
- Relações: contacts[] → Contact; leases[] → Lease; addresses[] → TenantAddress; company → Company
- Únicos compostos: company_id, internal_code
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### TenantAddress
- Campos: tenant_id: String; address_id: String
- Relações: address → Address; tenant → Tenant
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`TenantContactInput`, `TenantAddressInput`, `Tenant`, `CreateTenantData`, `UpdateTenantData`, `ListTenantsParams`, `PaginatedTenants`

## Validação (Zod, `src/shared/validators`)
- createTenantSchema: name?, internal_code?, nationality, occupation, marital_status, cpf, rg, rg_issuing_body, rg_issuing_state, cnpj, state_registration, municipal_registration, contacts? — tenant.ts
- updateTenantSchema: name?, internal_code?, nationality, occupation, marital_status, cpf, rg, rg_issuing_body, rg_issuing_state, cnpj, state_registration, municipal_registration, contacts?, addresses? — tenant.ts
- listTenantsQuerySchema: limit?, page?, search?, includeInactive? — tenant.ts

## Regras de negócio
- Código interno, CPF e CNPJ são únicos por empresa (`ConflictError`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- Profissão e Estado Civil têm obrigatoriedade indicada na inclusão; mensagens de validação em português.
- Pode ser criado rapidamente a partir do cadastro e da edição de locações (`Adicionar novo`, exige `create` em inquilinos): código `RAP...`, documento fictício aleatório e "A informar" — revisar depois.
- Contatos usam o componente `ContactManager` (tabelas `Contact` e `ContactChannel`).

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | ID é obrigatório | crud.ts |
| NotFoundError | Inquilino não encontrado | crud.ts |
| ConflictError | O Código Interno informado já está em uso por outro inquilino | crud.ts |
| ConflictError | O CPF informado já está cadastrado | crud.ts |
| ConflictError | O CNPJ informado já está cadastrado | crud.ts |
| ConflictError | O CPF informado já está cadastrado para outro inquilino | crud.ts |
| ConflictError | O CNPJ informado já está cadastrado para outro inquilino | crud.ts |
| ValidationError | O inquilino não está excluído | crud.ts |
