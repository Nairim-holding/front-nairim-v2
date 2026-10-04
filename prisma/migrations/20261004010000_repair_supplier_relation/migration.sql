BEGIN;
ALTER TABLE "Repair" ADD COLUMN "supplier_id" TEXT;
CREATE INDEX "Repair_supplier_id_idx" ON "Repair"("supplier_id");
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Vincula o histórico apenas quando existe um único contato ativo com o mesmo
-- nome na própria empresa. Nomes ambíguos continuam preservados sem vínculo.
WITH matches AS (
  SELECT r."id" AS repair_id, MIN(s."id") AS supplier_id
  FROM "Repair" r JOIN "Supplier" s
    ON s."company_id" = r."company_id"
   AND LOWER(BTRIM(s."legal_name")) = LOWER(BTRIM(r."professional"))
   AND s."deleted_at" IS NULL AND s."is_active" = TRUE
  GROUP BY r."id" HAVING COUNT(*) = 1
)
UPDATE "Repair" r SET "supplier_id" = matches.supplier_id
FROM matches WHERE r."id" = matches.repair_id;
COMMIT;
