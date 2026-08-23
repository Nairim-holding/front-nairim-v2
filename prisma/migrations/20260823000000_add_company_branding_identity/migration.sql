-- Identidade juridica e endereco do tenant.
--
-- Antes o cabecalho dos relatorios impressos/exportados lia CNPJ e endereco da
-- tabela "Agency" (Imobiliaria), que e outra pessoa juridica: o relatorio saia
-- com o nome fantasia do tenant e o endereco da imobiliaria cadastrada.
-- Company/CompanyBranding nao tinham nenhuma coluna de endereco.
--
-- Todas as colunas sao nullable: nenhuma linha existente precisa de backfill e
-- a migration nao trava em tabela com dados.

-- AlterTable
ALTER TABLE "CompanyBranding" ADD COLUMN     "legal_name" TEXT,
ADD COLUMN     "cnpj" VARCHAR(18),
ADD COLUMN     "phone" VARCHAR(20),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "zip_code" VARCHAR(10),
ADD COLUMN     "street" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "state" VARCHAR(2);
