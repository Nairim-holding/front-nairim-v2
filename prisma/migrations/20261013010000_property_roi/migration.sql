-- ROI por imóvel (doc de 13/10/2026).

-- Previsão de vacância em meses por ano, informada no cadastro do imóvel.
ALTER TABLE "PropertyValue" ADD COLUMN "vacancy_months_per_year" DECIMAL(4,2);

-- Categoria/subcategoria do Financeiro que alimenta cada linha do cálculo.
CREATE TABLE "RoiSettings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoiSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoiSettings_company_id_key" ON "RoiSettings"("company_id");
CREATE INDEX "RoiSettings_company_id_idx" ON "RoiSettings"("company_id");

ALTER TABLE "RoiSettings" ADD CONSTRAINT "RoiSettings_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mesma trilha de auditoria das demais tabelas de configuração.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = to_regclass('"RoiSettings"')
      AND NOT t.tgisinternal AND p.proname = 'nairim_write_audit_log'
  ) THEN
    CREATE TRIGGER nairim_audit_changes AFTER INSERT OR UPDATE OR DELETE ON "RoiSettings"
      FOR EACH ROW EXECUTE FUNCTION nairim_write_audit_log('RoiSettings');
  END IF;
END $$;
