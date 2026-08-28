-- Módulo Investimentos (menu Financeiro > Meus Investimentos).
--
-- Investment              → o papel em carteira. Reaproveita FinancialInstitution
--                           (FK) porque a corretora/banco já é cadastro do
--                           sistema; `partition` é a conta dentro dela.
-- InvestmentTransaction   → aportes/resgates. A aplicação inicial nasce como o
--                           primeiro registro aqui: é essa tabela que alimenta a
--                           linha "Aplicado" mês a mês.
-- InvestmentMonthBalance  → saldo total do mês, digitado pelo usuário. Mês sem
--                           registro herda saldo anterior + aplicado do mês.
-- InvestmentSettings      → valor de referência da independência financeira
--                           (uma linha por empresa).

-- CreateEnum
CREATE TYPE "InvestmentProductType" AS ENUM ('CDB', 'RDB', 'LCI', 'LCA', 'LC', 'LF', 'TESOURO_DIRETO', 'POUPANCA', 'DEBENTURE', 'CRI', 'CRA', 'COE', 'FUNDO', 'PREVIDENCIA', 'ACAO', 'FII', 'ETF', 'BDR', 'CRIPTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "InvestmentTransactionType" AS ENUM ('CONTRIBUTION', 'REDEMPTION');

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_institution_id" TEXT NOT NULL,
    "partition" TEXT NOT NULL DEFAULT 'Principal',
    "issuer" TEXT NOT NULL,
    "product_type" "InvestmentProductType" NOT NULL,
    "product" TEXT NOT NULL,
    "application_date" DATE NOT NULL,
    "maturity_date" DATE,
    "liquidity_days" INTEGER,
    "liquidity_at_maturity" BOOLEAN NOT NULL DEFAULT false,
    "invested_amount" DECIMAL(20,2) NOT NULL,
    "notes" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "liquidated_at" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentTransaction" (
    "id" TEXT NOT NULL,
    "investment_id" TEXT NOT NULL,
    "type" "InvestmentTransactionType" NOT NULL DEFAULT 'CONTRIBUTION',
    "date" DATE NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentMonthBalance" (
    "id" TEXT NOT NULL,
    "investment_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "balance" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "InvestmentMonthBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentSettings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "independence_reference_amount" DECIMAL(20,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Investment_company_id_idx" ON "Investment"("company_id");

-- CreateIndex
CREATE INDEX "Investment_financial_institution_id_idx" ON "Investment"("financial_institution_id");

-- CreateIndex
CREATE INDEX "Investment_display_order_idx" ON "Investment"("display_order");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_investment_id_idx" ON "InvestmentTransaction"("investment_id");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_date_idx" ON "InvestmentTransaction"("date");

-- CreateIndex
CREATE INDEX "InvestmentMonthBalance_investment_id_idx" ON "InvestmentMonthBalance"("investment_id");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentMonthBalance_investment_id_year_month_key" ON "InvestmentMonthBalance"("investment_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentSettings_company_id_key" ON "InvestmentSettings"("company_id");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_investment_id_fkey" FOREIGN KEY ("investment_id") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentMonthBalance" ADD CONSTRAINT "InvestmentMonthBalance_investment_id_fkey" FOREIGN KEY ("investment_id") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentSettings" ADD CONSTRAINT "InvestmentSettings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
