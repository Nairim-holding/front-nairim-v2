# Índices de reajuste — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### AdjustmentIndex
- Campos: code: String; description: String; sgs_code: Int?; sgs_code_12m: Int?; is_active: Boolean
- Relações: company → Company; values[] → AdjustmentIndexValue; leases[] → Lease
- Únicos compostos: company_id, code
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### AdjustmentIndexValue
- Campos: adjustment_index_id: String; reference_month: Int; reference_year: Int; monthly_rate: Decimal; accumulated_12m: Decimal?; synced_at: DateTime; from_api: Boolean
- Relações: adjustment_index → AdjustmentIndex
- Únicos compostos: adjustment_index_id, reference_year, reference_month
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`ADJUSTMENT_INDEX_CODES`, `AdjustmentIndexCode`, `SGS_SERIES`, `AUTO_UPDATABLE_CODES`, `ADJUSTMENT_INDEX_DESCRIPTIONS`, `SGS_BASE_URL`, `buildSgsUrl`, `formatSgsDate`, `SgsPoint`, `AdjustmentIndexPoint`, `parseSgsResponse`, `accumulate12Months`, `round4`, `mergeMonthlyAndAccumulated`, `AdjustmentIndex`, `AdjustmentIndexValue`, `CreateAdjustmentIndexData`, `UpdateAdjustmentIndexData`, `UpsertAdjustmentIndexValueData`, `ListAdjustmentIndexesParams`, `PaginatedAdjustmentIndexes`, `SyncResult`, `formatReference`, `sortValuesDesc`

## Validação (Zod, `src/shared/validators`)
- createAdjustmentIndexSchema: code, description, sgs_code?, sgs_code_12m?, is_active? — adjustment-index.ts
- updateAdjustmentIndexSchema: limit?, page?, search?, includeInactive — adjustment-index.ts
- listAdjustmentIndexesQuerySchema: limit?, page?, search?, includeInactive — adjustment-index.ts
- upsertAdjustmentIndexValueSchema: adjustment_index_id, reference_month, reference_year, monthly_rate, accumulated_12m — adjustment-index.ts
- syncAdjustmentIndexesSchema: months? — adjustment-index.ts

## Regras de negócio
- Cada indexador tem sigla e descrição obrigatórias e valores por mês/ano (`AdjustmentIndexValue`); gravação é idempotente por indexador+ano+mês.
- `AdjustmentIndexValue` não tem `company_id`: o isolamento vem do indexador pai.
- O botão **Atualizar pelo Banco Central** e a rotina `GET /api/cron/adjustment-indexes` usam o mesmo caso de uso e a API SGS do BCB (`infra/services/bcb-sgs-client.ts`). A rotina exige `Authorization: Bearer $CRON_SECRET`, percorre as empresas ativas e deve rodar uma vez por mês.
- Série sem dados no BCB (ex.: IVAR) não é sincronizada; o percentual pode ser lançado à mão.
- Os índices aparecem nos alertas de vencimento de contratos (índice de reajuste e dias restantes).

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | A sigla do indexador é obrigatória. | crud.ts |
| ValidationError | A descrição é obrigatória. | crud.ts |
| ValidationError | Mês de referência inválido. | crud.ts |
| ValidationError | Ano de referência inválido. | crud.ts |
| ValidationError | Percentual do mês inválido. | crud.ts |
