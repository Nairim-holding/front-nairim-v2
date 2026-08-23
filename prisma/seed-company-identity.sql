-- ---------------------------------------------------------------------------
-- Dados juridicos e endereco da empresa padrao (tenant).
--
-- Preenche as colunas de CompanyBranding adicionadas pela migration
-- 20260823000000_add_company_branding_identity. Sao esses campos que saem no
-- cabecalho dos relatorios impressos/exportados (razao social, CNPJ, telefone,
-- e-mail e endereco).
--
-- COMO RODAR:
--   npx prisma db execute --file prisma/seed-company-identity.sql
--
-- A URL do banco vem do prisma.config.ts (env DATABASE_URL) — a mesma usada
-- pelas migrations, entao nao ha risco de apontar para outro banco por engano.
--
-- Idempotente: rodar de novo so atualiza os valores. Cria a linha de
-- CompanyBranding se a empresa ainda nao tiver uma.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  -- >>> DADOS DA EMPRESA PADRAO <<<
  -- Fonte: Receita Federal (CNPJ 51.633.446/0001-94), consultada em 23/08/2026.
  -- Socio-administrador: Fabio Rodrigues Goncalves. Situacao: ATIVA.
  --
  -- Enquanto qualquer campo obrigatorio estiver como 'PREENCHER', o script
  -- aborta sem gravar nada: e melhor falhar do que estampar dado falso num
  -- documento que afirma identidade juridica.
  v_slug        text := 'nairim';
  v_legal_name  text := 'NAIRIM ADMINISTRADORA DE BENS LTDA';
  v_cnpj        text := '51.633.446/0001-94';
  v_phone       text := '(14) 8180-0001';
  v_email       text := '';            -- opcional; nao consta na Receita
  v_zip_code    text := '17400-152';
  v_street      text := 'Rua Joaquim Ramos Mendes';
  v_number      text := '323';
  v_complement  text := '';            -- opcional; nao consta na Receita
  v_district    text := 'Cascata';
  v_city        text := 'Garça';
  v_state       text := 'SP';
  -- >>> FIM <<<

  v_company_id  text;
  v_pending     text[];
BEGIN
  -- Trava: nenhum campo obrigatorio pode ficar como placeholder.
  v_pending := ARRAY(
    SELECT campo FROM (
      VALUES
        -- email e complement sao opcionais: nao constam no cadastro da Receita
        -- e o cabecalho do relatorio simplesmente omite o que vier vazio.
        ('legal_name', v_legal_name), ('cnpj', v_cnpj), ('phone', v_phone),
        ('zip_code', v_zip_code), ('street', v_street),
        ('number', v_number), ('district', v_district), ('city', v_city),
        ('state', v_state)
    ) AS t(campo, valor)
    WHERE valor = 'PREENCHER' OR btrim(valor) = ''
  );

  IF array_length(v_pending, 1) > 0 THEN
    RAISE EXCEPTION
      'Nada foi gravado. Preencha estes campos no topo do arquivo: %',
      array_to_string(v_pending, ', ');
  END IF;

  IF length(btrim(v_state)) <> 2 THEN
    RAISE EXCEPTION 'UF deve ter 2 letras (recebido: "%")', v_state;
  END IF;

  SELECT id INTO v_company_id
  FROM "Company"
  WHERE slug = v_slug AND deleted_at IS NULL;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION
      'Empresa com slug "%" nao existe neste banco. Confira o slug (o mesmo de NEXT_PUBLIC_COMPANY_SLUG) e se a URL DATABASE_URL aponta para o banco certo.',
      v_slug;
  END IF;

  INSERT INTO "CompanyBranding" (
    id, company_id,
    legal_name, cnpj, phone, email,
    zip_code, street, "number", complement, district, city, state,
    created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), v_company_id,
    v_legal_name, v_cnpj, v_phone, NULLIF(btrim(v_email), ''),
    v_zip_code, v_street, v_number, NULLIF(btrim(v_complement), ''), v_district, v_city, upper(v_state),
    now(), now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    legal_name = EXCLUDED.legal_name,
    cnpj       = EXCLUDED.cnpj,
    phone      = EXCLUDED.phone,
    email      = EXCLUDED.email,
    zip_code   = EXCLUDED.zip_code,
    street     = EXCLUDED.street,
    "number"   = EXCLUDED."number",
    complement = EXCLUDED.complement,
    district   = EXCLUDED.district,
    city       = EXCLUDED.city,
    state      = EXCLUDED.state,
    updated_at = now();

  RAISE NOTICE 'Dados da empresa "%" gravados com sucesso.', v_slug;
END $$;
