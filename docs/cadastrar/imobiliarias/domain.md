# Imobiliárias — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Agency
- Campos: trade_name: String; legal_name: String; cnpj: String; state_registration: String?; municipal_registration: String?; license_number: String?; commission_category_id: String?; commission_subcategory_id: String?; commission_percentage: Decimal?
- Relações: addresses[] → AgencyAddress; contacts[] → Contact; properties[] → Property; leases[] → Lease; suppliers[] → Supplier; commission_category → Category; commission_subcategory → Subcategory; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### AgencyAddress
- Campos: agency_id: String; address_id: String
- Relações: address → Address; agency → Agency
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`AgencyContactInput`, `AgencyAddressInput`, `Agency`, `CreateAgencyData`, `UpdateAgencyData`, `ListAgenciesParams`, `PaginatedAgencies`, `ContactSuggestion`

## Validação (Zod, `src/shared/validators`)
- createAgencySchema: trade_name, legal_name, cnpj, state_registration, municipal_registration, license_number, commission_category_id, commission_subcategory_id, commission_percentage, contacts?, addresses? — agency.ts
- updateAgencySchema: trade_name?, legal_name?, cnpj?, state_registration, municipal_registration, license_number, commission_category_id?, commission_subcategory_id?, commission_percentage?, contacts?, addresses? — agency.ts
- listAgenciesQuerySchema: limit?, page?, search?, includeInactive? — agency.ts

## Regras de negócio
- CNPJ não pode se repetir na empresa. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- Para cadastrar uma locação a imobiliária precisa de categoria, subcategoria e **% de comissão** (zero é aceito); o formulário exige esses campos e o servidor revalida (`AGENCY_FINANCIAL_SETUP_ERROR`).
- `commission_percentage` é gravado na criação e na edição; edição parcial preserva categoria/subcategoria ausentes do pedido. Valores antigos nunca gravados precisam ser informados de novo (não são estimados).
- A geração financeira cria um espelho `Supplier` (código `AG-...`) por imobiliária e procura um cadastro único pelo CNPJ antes de criar; casos ambíguos exigem consolidação (`scripts/consolidate-agency-suppliers.mjs`, modo prévia por padrão).

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Imobiliária não encontrada | crud.ts |
| ConflictError | CNPJ já cadastrado | crud.ts |
| ConflictError | CNPJ já cadastrado para outra imobiliária | crud.ts |
| NotFoundError | Imobiliária não encontrada ou já excluída | crud.ts |
| ValidationError | A imobiliária não está excluída | crud.ts |
