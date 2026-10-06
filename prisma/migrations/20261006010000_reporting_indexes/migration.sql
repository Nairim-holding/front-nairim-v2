-- Indexes for bounded multi-company date ranges used by dashboards/reports.
CREATE INDEX IF NOT EXISTS "Transaction_reporting_effective_idx"
  ON "Transaction" (company_id, effective_date) WHERE deleted_at IS NULL AND is_transfer = false;
CREATE INDEX IF NOT EXISTS "Transaction_reporting_event_idx"
  ON "Transaction" (company_id, event_date) WHERE deleted_at IS NULL AND is_transfer = false;
CREATE INDEX IF NOT EXISTS "Property_reporting_created_idx"
  ON "Property" (company_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS "Lease_reporting_start_idx"
  ON "Lease" (company_id, start_date) WHERE deleted_at IS NULL;
