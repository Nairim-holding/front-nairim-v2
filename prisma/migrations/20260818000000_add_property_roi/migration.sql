-- Tarefa 4.2 (ROI por imóvel): valor/data de aquisição no cadastro do imóvel
-- e parametrização das categorias que compõem retorno e gasto.
-- Migração puramente aditiva: nenhuma coluna ou tabela existente é alterada.

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "acquisition_date" TIMESTAMP(3),
ADD COLUMN     "acquisition_value" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "RoiSettings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "income_category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "income_subcategory_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expense_category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expense_subcategory_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoiSettings_company_id_key" ON "RoiSettings"("company_id");

-- CreateIndex
CREATE INDEX "RoiSettings_company_id_idx" ON "RoiSettings"("company_id");

-- AddForeignKey
ALTER TABLE "RoiSettings" ADD CONSTRAINT "RoiSettings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
