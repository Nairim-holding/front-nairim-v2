-- ============================================================================
-- Etapa 3 — Consolidação de contatos duplicados
--
-- ⚠️  NÃO É EXECUTADO AUTOMATICAMENTE. Este arquivo mora fora de
--     prisma/migrations/ de propósito: `prisma migrate deploy` NÃO o aplica.
--
-- O que faz: junta contatos que foram cadastrados várias vezes só para
-- guardar telefones/e-mails diferentes da MESMA pessoa. O primeiro registro
-- (mais antigo) vira o contato canônico; os telefones/e-mails dos demais
-- viram ContactChannel dele; e os registros redundantes são marcados como
-- excluídos via soft delete (`deleted_at`), nunca apagados fisicamente.
--
-- Por que exige conferência humana antes de rodar:
--   • O critério de "mesma pessoa" é o nome normalizado dentro do mesmo dono
--     (tenant/owner/agency/supplier). Homônimos reais SERÃO fundidos.
--   • Contatos sem nome não são tocados — não há como afirmar que são a mesma
--     pessoa só porque pertencem ao mesmo cadastro.
--
-- Como usar com segurança:
--   1. Faça backup do banco.
--   2. Rode só o bloco PRÉVIA e confira a lista de fusões proposta.
--   3. Se a prévia estiver correta, rode o bloco CONSOLIDAÇÃO dentro de uma
--      transação e confira os totais antes do COMMIT.
-- ============================================================================


-- ─── 1. PRÉVIA (somente leitura) ────────────────────────────────────────────
-- Mostra os grupos que SERIAM fundidos, sem alterar nada.
-- Rode isto primeiro e revise linha a linha.

WITH normalized AS (
  SELECT
    c.id,
    c.contact,
    c.tenant_id, c.owner_id, c.agency_id, c.supplier_id,
    c.created_at,
    lower(btrim(regexp_replace(c.contact, '\s+', ' ', 'g'))) AS name_key,
    coalesce(c.tenant_id::text, '') || '|' || coalesce(c.owner_id::text, '')
      || '|' || coalesce(c.agency_id::text, '') || '|' || coalesce(c.supplier_id::text, '') AS owner_key
  FROM "Contact" c
  WHERE c.deleted_at IS NULL
    AND c.contact IS NOT NULL
    AND btrim(c.contact) <> ''
)
SELECT
  owner_key,
  name_key,
  count(*)                        AS registros,
  min(created_at)                 AS primeiro_cadastro,
  array_agg(id ORDER BY created_at) AS ids
FROM normalized
GROUP BY owner_key, name_key
HAVING count(*) > 1
ORDER BY count(*) DESC, name_key;


-- ─── 2. CONSOLIDAÇÃO (altera dados) ─────────────────────────────────────────
-- Descomente e rode SOMENTE depois de conferir a prévia acima.
--
-- BEGIN;
--
-- WITH normalized AS (
--   SELECT
--     c.id, c.contact, c.phone, c.cellphone, c.email, c.created_at,
--     lower(btrim(regexp_replace(c.contact, '\s+', ' ', 'g'))) AS name_key,
--     coalesce(c.tenant_id::text, '') || '|' || coalesce(c.owner_id::text, '')
--       || '|' || coalesce(c.agency_id::text, '') || '|' || coalesce(c.supplier_id::text, '') AS owner_key
--   FROM "Contact" c
--   WHERE c.deleted_at IS NULL AND c.contact IS NOT NULL AND btrim(c.contact) <> ''
-- ),
-- ranked AS (
--   SELECT *, row_number() OVER (PARTITION BY owner_key, name_key ORDER BY created_at, id) AS rn
--   FROM normalized
-- ),
-- canonical AS (SELECT * FROM ranked WHERE rn = 1),
-- duplicates AS (SELECT * FROM ranked WHERE rn > 1),
-- -- Cada telefone/e-mail dos duplicados vira um canal do contato canônico.
-- moved AS (
--   SELECT can.id AS contact_id, v.kind, v.value,
--          row_number() OVER (PARTITION BY can.id, v.kind ORDER BY d.created_at) AS display_order
--   FROM duplicates d
--   JOIN canonical can ON can.owner_key = d.owner_key AND can.name_key = d.name_key
--   CROSS JOIN LATERAL (VALUES
--     ('CELLPHONE', d.cellphone),
--     ('PHONE',     d.phone),
--     ('EMAIL',     d.email)
--   ) AS v(kind, value)
--   WHERE v.value IS NOT NULL AND btrim(v.value) <> ''
--     -- Não recria o que já é o valor principal do canônico.
--     AND btrim(lower(v.value)) NOT IN (
--       coalesce(btrim(lower(can.cellphone)), ''),
--       coalesce(btrim(lower(can.phone)), ''),
--       coalesce(btrim(lower(can.email)), '')
--     )
-- )
-- INSERT INTO "ContactChannel" (id, contact_id, kind, value, display_order, created_at, updated_at)
-- SELECT gen_random_uuid(), contact_id, kind::"ContactChannelKind", btrim(value), display_order, now(), now()
-- FROM moved
-- ON CONFLICT DO NOTHING;
--
-- -- Soft delete dos duplicados (nada é removido fisicamente).
-- WITH normalized AS (
--   SELECT c.id, c.created_at,
--     lower(btrim(regexp_replace(c.contact, '\s+', ' ', 'g'))) AS name_key,
--     coalesce(c.tenant_id::text, '') || '|' || coalesce(c.owner_id::text, '')
--       || '|' || coalesce(c.agency_id::text, '') || '|' || coalesce(c.supplier_id::text, '') AS owner_key
--   FROM "Contact" c
--   WHERE c.deleted_at IS NULL AND c.contact IS NOT NULL AND btrim(c.contact) <> ''
-- ),
-- ranked AS (
--   SELECT id, row_number() OVER (PARTITION BY owner_key, name_key ORDER BY created_at, id) AS rn
--   FROM normalized
-- )
-- UPDATE "Contact" SET deleted_at = now(), updated_at = now()
-- WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--
-- -- Confira os números antes de confirmar:
-- --   SELECT count(*) FROM "Contact" WHERE deleted_at IS NULL;
-- --   SELECT count(*) FROM "ContactChannel";
-- --
-- -- COMMIT;   -- ou ROLLBACK; se algo estiver estranho.
