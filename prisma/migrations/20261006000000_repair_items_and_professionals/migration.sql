BEGIN;
ALTER TABLE "Repair" ADD COLUMN "problem_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Repair" SET "problem_types" = ARRAY["problem_type"];
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_problem_types_check"
  CHECK ("problem_types" <@ ARRAY['STRUCTURAL', 'ELECTRICAL', 'HYDRAULIC', 'FINISHING']::TEXT[]);

CREATE TABLE "RepairProfessional" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "repair_id" TEXT NOT NULL, "supplier_id" TEXT NOT NULL,
  CONSTRAINT "RepairProfessional_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepairProfessional_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepairProfessional_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RepairProfessional_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RepairProfessional_repair_id_supplier_id_key" ON "RepairProfessional"("repair_id", "supplier_id");
CREATE INDEX "RepairProfessional_company_id_repair_id_idx" ON "RepairProfessional"("company_id", "repair_id");
INSERT INTO "RepairProfessional" ("id", "company_id", "repair_id", "supplier_id")
SELECT 'legacy-' || "id", "company_id", "id", "supplier_id" FROM "Repair" WHERE "supplier_id" IS NOT NULL;

CREATE TABLE "RepairItem" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "repair_id" TEXT NOT NULL,
  "description" TEXT NOT NULL, "kind" VARCHAR(20) NOT NULL, "supplier_id" TEXT NOT NULL,
  "professional" TEXT NOT NULL, "amount" DECIMAL(20,2) NOT NULL, "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RepairItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepairItem_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepairItem_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RepairItem_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepairItem_kind_check" CHECK ("kind" IN ('LABOR', 'MATERIAL')),
  CONSTRAINT "RepairItem_amount_check" CHECK ("amount" >= 0)
);
CREATE INDEX "RepairItem_company_id_repair_id_idx" ON "RepairItem"("company_id", "repair_id");
CREATE INDEX "RepairItem_supplier_id_idx" ON "RepairItem"("supplier_id");
CREATE TRIGGER nairim_audit AFTER INSERT OR UPDATE OR DELETE ON "RepairProfessional"
  FOR EACH ROW EXECUTE FUNCTION nairim_write_audit_log('RepairProfessional');
CREATE TRIGGER nairim_audit AFTER INSERT OR UPDATE OR DELETE ON "RepairItem"
  FOR EACH ROW EXECUTE FUNCTION nairim_write_audit_log('RepairItem');
COMMIT;
