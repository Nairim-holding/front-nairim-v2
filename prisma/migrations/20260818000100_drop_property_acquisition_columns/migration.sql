-- Reverte as colunas de aquisição criadas na migração anterior: o valor pago
-- na compra do imóvel já existia em "PropertyValue" (purchase_value /
-- purchase_date), preenchido pelo cadastro do imóvel na aba Valores. Manter
-- dois campos para o mesmo dado só criaria divergência.
--
-- Seguro: as colunas foram criadas vazias na mesma sessão e nunca receberam
-- escrita (nenhum código do app chegou a gravá-las).

ALTER TABLE "Property" DROP COLUMN IF EXISTS "acquisition_value";
ALTER TABLE "Property" DROP COLUMN IF EXISTS "acquisition_date";
