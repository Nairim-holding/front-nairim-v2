-- Campos que alimentam o Relatório de Locações (menu Locações > Relatórios).
--
-- Property.income_tax_withholding: marca o imóvel cuja locação sofre IRRF.
-- Só as locações de imóveis marcados entram no quadro "Retenções dos
-- Aluguéis" (PIS/COFINS/IRPJ/CSLL) do relatório. Default false — hoje só um
-- imóvel da carteira exige retenção.
--
-- Lease.discount_amount: desconto/despesa acordado na locação, abatido do
-- valor líquido. Coluna própria porque `extra_charges` (Taxas Extras) é
-- cobrança adicional, com sinal oposto — reaproveitá-la inverteria o cálculo.

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "income_tax_withholding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "discount_amount" DECIMAL(20,2);
