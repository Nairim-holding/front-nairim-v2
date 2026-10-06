CREATE TABLE "PublicSiteSettings" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "company_id" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicSiteSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicSiteSettings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PublicSiteSettings_company_id_key" ON "PublicSiteSettings"("company_id");
