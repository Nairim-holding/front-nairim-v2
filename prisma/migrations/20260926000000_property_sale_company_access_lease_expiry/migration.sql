ALTER TYPE "PropertyStatus" ADD VALUE IF NOT EXISTS 'SOLD';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PROPERTY_SALE';
ALTER TABLE "PropertyValue" ADD COLUMN "sale_buyer" TEXT;
ALTER TABLE "User" ADD COLUMN "all_companies_access" BOOLEAN NOT NULL DEFAULT false,
                   ADD COLUMN "allowed_company_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "LeaseExpiryReminder" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "lease_id" TEXT NOT NULL,
  "end_date" DATE NOT NULL,
  "shown_days" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "acknowledged_on" TEXT,
  "dismissed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "LeaseExpiryReminder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaseExpiryReminder_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeaseExpiryReminder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeaseExpiryReminder_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LeaseExpiryReminder_user_id_lease_id_end_date_key" ON "LeaseExpiryReminder"("user_id", "lease_id", "end_date");
CREATE INDEX "LeaseExpiryReminder_company_id_user_id_idx" ON "LeaseExpiryReminder"("company_id", "user_id");

DROP INDEX "UserColumnPreference_user_id_resource_key";
DROP INDEX "UserDashboardLayout_user_id_resource_key";
CREATE UNIQUE INDEX "UserColumnPreference_company_id_user_id_resource_key" ON "UserColumnPreference"("company_id", "user_id", "resource");
CREATE UNIQUE INDEX "UserDashboardLayout_company_id_user_id_resource_key" ON "UserDashboardLayout"("company_id", "user_id", "resource");
