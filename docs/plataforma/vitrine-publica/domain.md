# Vitrine pública de imóveis — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Property
- Campos: owner_id: String; agency_id: String?; type_id: String; center_id: String?; debit_center_id: String?; category_id: String?; subcategory_id: String?; iptu_refund_category_id: String?; iptu_refund_subcategory_id: String?; title: String; registration_number: String?; bedrooms: Int; bathrooms: Int; half_bathrooms: Int; garage_spaces: Int; area_total: Float; area_built: Float; frontage: Float; furnished: Boolean; floor_number: Int?; tax_registration: String; income_tax_withholding: Boolean; notes: String?
- Relações: documents[] → Document; favorites[] → Favorite; leases[] → Lease; repairs[] → Repair; agency → Agency; owner → Owner; type → PropertyType; center → Center; debit_center → Center; category → Category; subcategory → Subcategory; iptu_refund_category → Category; iptu_refund_subcategory → Subcategory; addresses[] → PropertyAddress; iptus[] → PropertyIptu; values[] → PropertyValue; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`PublicListParams`, `PublicPaginated`, `PublicPropertyAddress`, `PublicPropertyDocument`, `PublicPropertyValue`, `PublicProperty`, `PublicOwner`, `PublicPropertyType`, `PublicAgency`, `PublicCompany`

## Validação (Zod, `src/shared/validators`)
—

## Regras de negócio
- Rotas públicas (sem login): `/casas/[id]`, `/imoveis/[id]` e os prefixos `/apartamentos/` e `/comerciais/` (lista `PUBLIC_PREFIXES` em `src/middleware.ts`).
- Paginação pública em `core/utils/public-pagination.ts`; parâmetros validados em `shared/validators/public.ts`.
- A vitrine expõe **apenas campos de vitrine**: endereço parcial (rua, número, bairro, cidade, estado, país), documentos só do tipo `IMAGE` e o valor mais recente do imóvel (`core/entities/public-property.ts`). Mantenha assim ao alterar a seleção.
- O formulário de contato chega em `POST /api/lead`, que repassa para `NEXT_PUBLIC_URL_API`.
