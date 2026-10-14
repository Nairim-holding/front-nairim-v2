-- Marca os lançamentos excluídos pelo cancelamento da locação. Até aqui o único
-- rastro era `deleted_at`, o mesmo campo usado quando a edição da locação apaga
-- e recria as parcelas pendentes — o Histórico Financeiro do contrato não tinha
-- como separar "cancelado" de "regenerado".
ALTER TABLE "Transaction" ADD COLUMN "canceled_at" TIMESTAMP(3);

-- Cancelamentos anteriores a este campo: lançamentos da locação cancelada,
-- excluídos, com vencimento a partir da data do cancelamento. Encargos de
-- cancelamento nunca são excluídos por esse fluxo e ficam de fora.
UPDATE "Transaction" AS t
SET "canceled_at" = t."deleted_at"
FROM "Lease" AS l
WHERE t."lease_id" = l."id"
  AND t."deleted_at" IS NOT NULL
  AND t."canceled_at" IS NULL
  AND t."is_cancellation_charge" = false
  AND t."status" <> 'COMPLETED'
  AND l."status" = 'CANCELED'
  AND l."canceled_at" IS NOT NULL
  AND t."effective_date" >= l."canceled_at"::date;
