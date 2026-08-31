-- CreateEnum
CREATE TYPE "ContactChannelKind" AS ENUM ('CELLPHONE', 'PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "HolidayScope" AS ENUM ('NATIONAL', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "LeaseNotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "LeaseOverdueStatus" AS ENUM ('NOTIFIED', 'NEGOTIATING');

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "adjustment_index_id" TEXT,
ADD COLUMN     "overdue_status" "LeaseOverdueStatus";

-- CreateTable
CREATE TABLE "ContactChannel" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "kind" "ContactChannelKind" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ContactChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentIndex" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sgs_code" INTEGER,
    "sgs_code_12m" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "AdjustmentIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentIndexValue" (
    "id" TEXT NOT NULL,
    "adjustment_index_id" TEXT NOT NULL,
    "reference_month" INTEGER NOT NULL,
    "reference_year" INTEGER NOT NULL,
    "monthly_rate" DECIMAL(10,4) NOT NULL,
    "accumulated_12m" DECIMAL(10,4),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_api" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "AdjustmentIndexValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "scope" "HolidayScope" NOT NULL DEFAULT 'NATIONAL',
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseNotification" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "channel" "LeaseNotificationChannel" NOT NULL,
    "recipient" TEXT,
    "message" TEXT,
    "reference_month" INTEGER NOT NULL,
    "reference_year" INTEGER NOT NULL,
    "days_overdue" INTEGER,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "LeaseNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactChannel_contact_id_idx" ON "ContactChannel"("contact_id");

-- CreateIndex
CREATE INDEX "ContactChannel_contact_id_kind_idx" ON "ContactChannel"("contact_id", "kind");

-- CreateIndex
CREATE INDEX "AdjustmentIndex_company_id_idx" ON "AdjustmentIndex"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentIndex_company_id_code_key" ON "AdjustmentIndex"("company_id", "code");

-- CreateIndex
CREATE INDEX "AdjustmentIndexValue_adjustment_index_id_idx" ON "AdjustmentIndexValue"("adjustment_index_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentIndexValue_adjustment_index_id_reference_year_ref_key" ON "AdjustmentIndexValue"("adjustment_index_id", "reference_year", "reference_month");

-- CreateIndex
CREATE INDEX "Holiday_company_id_idx" ON "Holiday"("company_id");

-- CreateIndex
CREATE INDEX "Holiday_company_id_date_idx" ON "Holiday"("company_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_company_id_date_description_key" ON "Holiday"("company_id", "date", "description");

-- CreateIndex
CREATE INDEX "LeaseNotification_company_id_idx" ON "LeaseNotification"("company_id");

-- CreateIndex
CREATE INDEX "LeaseNotification_lease_id_idx" ON "LeaseNotification"("lease_id");

-- CreateIndex
CREATE INDEX "Lease_adjustment_index_id_idx" ON "Lease"("adjustment_index_id");

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_adjustment_index_id_fkey" FOREIGN KEY ("adjustment_index_id") REFERENCES "AdjustmentIndex"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactChannel" ADD CONSTRAINT "ContactChannel_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentIndex" ADD CONSTRAINT "AdjustmentIndex_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentIndexValue" ADD CONSTRAINT "AdjustmentIndexValue_adjustment_index_id_fkey" FOREIGN KEY ("adjustment_index_id") REFERENCES "AdjustmentIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseNotification" ADD CONSTRAINT "LeaseNotification_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseNotification" ADD CONSTRAINT "LeaseNotification_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseNotification" ADD CONSTRAINT "LeaseNotification_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

