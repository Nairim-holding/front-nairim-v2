# Contatos (fornecedores) — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Supplier
- Campos: sequential_id: Int; legal_name: String; trade_name: String?; cnpj: String?; state_registration: String?; municipal_registration: String?; cpf: String?; internal_code: String?; created_via: String?; is_active: Boolean; marital_status: String?; occupation: String?; agency_id: String?
- Relações: repair_professionals[] → RepairProfessional; repair_items[] → RepairItem; contacts[] → Contact; recurring_configs[] → RecurringConfig; addresses[] → SupplierAddress; transactions[] → Transaction; repairs[] → Repair; agency → Agency; company → Company
- Únicos compostos: company_id, internal_code
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### SupplierAddress
- Campos: supplier_id: String; address_id: String
- Relações: address → Address; supplier → Supplier
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

### Contact
- Campos: contact: String?; phone: String?; email: String?; cellphone: String?; whatsapp_notification_phone: String?; agency_id: String?; owner_id: String?; tenant_id: String?; supplier_id: String?
- Relações: agency → Agency; owner → Owner; supplier → Supplier; tenant → Tenant; channels[] → ContactChannel
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

### ContactChannel
- Campos: contact_id: String; kind: ContactChannelKind; value: String; label: String?; display_order: Int
- Relações: contact → Contact
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`SupplierContactInput`, `SupplierAddressInput`, `AddressRecord`, `SupplierAddressRecord`, `SupplierContactRecord`, `Supplier`, `CreateSupplierData`, `UpdateSupplierData`, `ListSuppliersParams`, `PaginatedSuppliers`, `SearchableSupplier`, `matchesSupplierSearch`, `ContactChannelKind`, `ContactChannel`, `ContactWithChannels`, `ContactFormValue`, `normalizeValues`, `toFormValue`, `toPersistedValue`, `hasAnyValue`, `allChannelValues`

## Validação (Zod, `src/shared/validators`)
- createFinancialSupplierSchema: legal_name, trade_name?, cnpj, cpf, internal_code?, occupation?, marital_status?, state_registration?, municipal_registration?, addresses?, contacts? — financial-supplier.ts
- updateFinancialSupplierSchema: limit?, page?, search?, includeInactive? — financial-supplier.ts
- listFinancialSuppliersQuerySchema: limit?, page?, search?, includeInactive? — financial-supplier.ts
- quickCreateFinancialSupplierSchema: legal_name — financial-supplier.ts

## Regras de negócio
- Nome/Razão Social obrigatório; CNPJ com 14 dígitos e CPF com 11; duplicidade de CNPJ/CPF recusada (409) em português. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- Contatos com código `AG-...` são espelhos de imobiliária (Supplier), não do cadastro de contatos de telefone (`Contact`).
- O responsável pelo reparo é um contato ativo da empresa (`supplier_id`); cadastro rápido permitido com a permissão de criar contatos.
- Consolidação de duplicados: `scripts/consolidate-agency-suppliers.mjs` (prévia por padrão; `--apply` com backup e IDs escolhidos pela identidade cadastral).

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Fornecedor não encontrado | crud.ts |
| ValidationError | CNPJ inválido. Deve conter 14 dígitos. | crud.ts |
| ValidationError | CPF inválido. Deve conter 11 dígitos. | crud.ts |
| ValidationError | O Nome / Razão Social é obrigatório | crud.ts |
| ValidationError | Fornecedor não está excluído | crud.ts |
| ValidationError | legal_name é obrigatório e deve ter entre 2 e 150 caracteres. | crud.ts |
