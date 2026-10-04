BEGIN;
CREATE TABLE "Repair" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "property_id" TEXT NOT NULL,
  "event_date" DATE NOT NULL, "event_type" VARCHAR(20) NOT NULL, "problem_type" VARCHAR(40) NOT NULL,
  "description" TEXT NOT NULL, "professional" TEXT NOT NULL,
  "service_amount" DECIMAL(20,2) NOT NULL, "materials_amount" DECIMAL(20,2) NOT NULL,
  "payment_method" TEXT NOT NULL, "payment_conditions" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PLANNED', "start_date" DATE, "completion_date" DATE,
  "notes" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, "deleted_at" TIMESTAMP(3),
  CONSTRAINT "Repair_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Repair_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Repair_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Repair_amounts_check" CHECK ("service_amount" >= 0 AND "materials_amount" >= 0),
  CONSTRAINT "Repair_event_type_check" CHECK ("event_type" IN ('REPAIR','RENOVATION')),
  CONSTRAINT "Repair_status_check" CHECK ("status" IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  CONSTRAINT "Repair_problem_type_check" CHECK ("problem_type" IN ('STRUCTURAL','ELECTRICAL','HYDRAULIC','FINISHING'))
);
CREATE INDEX "Repair_company_id_event_date_idx" ON "Repair"("company_id", "event_date");
CREATE INDEX "Repair_property_id_idx" ON "Repair"("property_id");
CREATE TABLE "RepairMedia" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "repair_id" TEXT NOT NULL,
  "stage" VARCHAR(10) NOT NULL, "filename" TEXT NOT NULL, "url" TEXT NOT NULL,
  "content_type" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepairMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepairMedia_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepairMedia_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RepairMedia_stage_check" CHECK ("stage" IN ('BEFORE','AFTER'))
);
CREATE INDEX "RepairMedia_company_id_repair_id_idx" ON "RepairMedia"("company_id", "repair_id");
CREATE TRIGGER nairim_audit AFTER INSERT OR UPDATE OR DELETE ON "Repair"
  FOR EACH ROW EXECUTE FUNCTION nairim_write_audit_log('Repair');
CREATE TRIGGER nairim_audit AFTER INSERT OR UPDATE OR DELETE ON "RepairMedia"
  FOR EACH ROW EXECUTE FUNCTION nairim_write_audit_log('RepairMedia');
COMMIT;

