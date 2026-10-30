# Imóveis — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Property
- Campos: owner_id: String; agency_id: String?; type_id: String; center_id: String?; debit_center_id: String?; category_id: String?; subcategory_id: String?; iptu_refund_category_id: String?; iptu_refund_subcategory_id: String?; title: String; registration_number: String?; bedrooms: Int; bathrooms: Int; half_bathrooms: Int; garage_spaces: Int; area_total: Float; area_built: Float; frontage: Float; furnished: Boolean; floor_number: Int?; tax_registration: String; income_tax_withholding: Boolean; notes: String?
- Relações: documents[] → Document; favorites[] → Favorite; leases[] → Lease; repairs[] → Repair; agency → Agency; owner → Owner; type → PropertyType; center → Center; debit_center → Center; category → Category; subcategory → Subcategory; iptu_refund_category → Category; iptu_refund_subcategory → Subcategory; addresses[] → PropertyAddress; iptus[] → PropertyIptu; values[] → PropertyValue; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### PropertyValue
- Campos: property_id: String; purchase_value: Decimal?; market_value: Decimal?; rental_value: Decimal?; condo_fee: Decimal; property_tax: Decimal; status: PropertyStatus; notes: String?; extra_charges: Decimal?; sale_value: Decimal?; sale_buyer: String?; sale_notes: String?; sale_date: DateTime?; purchase_date: DateTime?; vacancy_months_per_year: Decimal?
- Relações: property → Property
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

### PropertyAddress
- Campos: property_id: String; address_id: String
- Relações: address → Address; property → Property
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

### PropertyIptu
- Campos: property_id: String; year: Int; property_tax: Decimal?; property_tax_cash: Decimal?; property_tax_cash_due_date: DateTime?; property_tax_first_installment: Decimal?; property_tax_first_installment_due_date: DateTime?; property_tax_second_installment: Decimal?; property_tax_second_installment_due_date: DateTime?; iptu_installments_count: Int?; iptu_installments: Json?; payment_condition: PaymentCondition?
- Relações: property → Property
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

### Document
- Campos: property_id: String?; lease_id: String?; transaction_id: String?; created_by: String?; file_path: String; file_type: String; description: String?; type: DocumentType; is_featured: Boolean
- Relações: user → User; property → Property; lease → Lease; transaction → Transaction; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### Favorite
- Campos: user_id: String; property_id: String
- Relações: property → Property; user → User; company → Company
- Únicos compostos: user_id, property_id
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`PropertyAddressInput`, `PropertyValueInput`, `PropertyIptuInput`, `Property`, `CreateUnifiedPropertyData`, `UpdateUnifiedPropertyData`, `PropertyUploadFile`, `PropertyUploadFiles`, `ListPropertiesParams`, `PaginatedProperties`, `PaymentCondition`, `IptuPropertyFiltersParams`, `IptuPropertyFilter`, `IptuPropertyOperators`, `IptuPropertyFiltersResult`, `PdfTextItem`, `PdfToken`, `PdfRow`, `PdfPageLayout`, `layoutFromTextItems`, `MunicipalDocumentKind`, `MunicipalIptuInstallment`, `MunicipalIptu`, `MunicipalPropertyData`, `parseBrazilianNumber`, `titleCase`, `parseMunicipalPropertyDocument`, `mergeMunicipalDocuments`, `sameMunicipalProperty`, `MunicipalPrefillField`

## Validação (Zod, `src/shared/validators`)
- createUnifiedPropertySchema: title, registration_number, bedrooms, bathrooms, half_bathrooms?, garage_spaces?, area_total, area_built?, frontage?, furnished, income_tax_withholding?, floor_number, tax_registration, notes, owner_id, type_id, agency_id, center_id, debit_center_id, category_id, subcategory_id, iptu_refund_category_id, iptu_refund_subcategory_id, address?, values?, iptus? — property.ts
- updateUnifiedPropertySchema: limit?, page?, search?, includeInactive? — property.ts
- listPropertiesQuerySchema: limit?, page?, search?, includeInactive? — property.ts
- locationSuggestionSchema: street, number, district?, city, state, zip_code?, country? — location-suggestion.ts

## Regras de negócio
- Criação e edição são "unificadas": dados, documentos novos e remoção de documentos numa única operação (`createUnifiedPropertyAction`, `updateUnifiedPropertyAction`).
- O imóvel precisa de seis vínculos financeiros para cadastrar locações: Categoria Aluguel, Subcategoria Aluguel, Centro de Custo (Crédito), Centro de Custo (Débito), Categoria (Restituição de IPTU) e Subcategoria (Restituição de IPTU); o formulário os exige (`PROPERTY_FINANCIAL_FIELDS` em `shared/validators/lease-financial-setup.ts`).
- Status (`AVAILABLE`, `OCCUPIED`, `SOLD`) vem do `PropertyValue` mais recente. Registrar venda exige antes encerrar ou cancelar a locação vigente. Contratos vencidos liberam o imóvel automaticamente (`property-occupancy.ts`); imóvel ocupado manualmente sem histórico de locação não é liberado.
- IPTUs antigos inalterados não bloqueiam alteração de status; IPTUs novos ou alterados passam pela validação completa. Nenhuma data é inventada para o legado.
- **Duplicar** (ícone entre filtro e exclusão, exige `create`): copia endereço, valores, IPTUs e arquivos independentes; não copia contratos, reparos nem lançamentos. Dependências equivalentes são reutilizadas por nome/tipo/categoria pai (proprietário por documento); ausentes são criadas; duplicidade ambígua interrompe aquela cópia. Uma transação por imóvel e empresa (`server/services/property-clone.ts`).
- Localização: pin sugerido pela Geoapify, mas só vale após **confirmação** do usuário (ver [localizacao.md](localizacao.md)). Imóvel pendente salva, mas não aparece no mapa do Resumo.
- Cadastro rápido de proprietário, tipo de imóvel e imobiliária direto no formulário (`quickCreateRecordAction`), com dados provisórios que exigem revisão.
- Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| NotFoundError | Proprietário não encontrado | create-unified.ts |
| NotFoundError | Tipo de propriedade não encontrado | create-unified.ts |
| NotFoundError | Agência não encontrada | create-unified.ts |
| ValidationError | Campos obrigatórios ausentes | create-unified.ts |
| ValidationError | ID is required | crud.ts |
| NotFoundError | Property not found or already deleted | crud.ts |
| NotFoundError | Property not found | crud.ts |
| ValidationError | Property is not deleted | crud.ts |
| ValidationError | ID da propriedade é obrigatório | update-unified.ts |
| NotFoundError | Propriedade não encontrada | update-unified.ts |
| ValidationError | Encerre ou cancele a locação vigente antes de registrar a venda. | update-unified.ts |
