-- O campo de IRRF foi adicionado inicialmente com DEFAULT false. O imóvel que
-- já possuía retenção antes dessa coluna existir, portanto, permaneceu sem a
-- marca e desapareceu da apuração de retenções do Relatório de Locações.
--
-- Identifica-o tanto pelo título quanto pelo endereço cadastrado para tolerar
-- as abreviações "Av." / "Avenida" usadas nas bases existentes.
UPDATE "Property" AS p
SET "income_tax_withholding" = true
WHERE p."deleted_at" IS NULL
  AND (
    (
      lower(p."title") LIKE '%rafael paes de barros%'
      AND regexp_replace(p."title", '\D', '', 'g') = '55'
    )
    OR EXISTS (
      SELECT 1
      FROM "PropertyAddress" AS pa
      JOIN "Address" AS a ON a."id" = pa."address_id"
      WHERE pa."property_id" = p."id"
        AND pa."deleted_at" IS NULL
        AND a."deleted_at" IS NULL
        AND lower(a."street") LIKE '%rafael paes de barros%'
        AND regexp_replace(coalesce(a."number", ''), '\D', '', 'g') = '55'
    )
  );
