-- Add operation events without changing existing CRUD history.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EXPORT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IMPORT';

CREATE OR REPLACE FUNCTION nairim_write_audit_log() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  previous jsonb;
  current_row jsonb;
  row_data jsonb;
  actor jsonb := coalesce(nullif(current_setting('nairim.audit_actor', true), ''), '{}')::jsonb;
  tenant_id text;
  actor_id text;
  parent_table text;
  parent_key text;
  operation "AuditAction";
BEGIN
  IF TG_OP <> 'INSERT' THEN previous := nairim_audit_snapshot(to_jsonb(OLD)); END IF;
  IF TG_OP <> 'DELETE' THEN current_row := nairim_audit_snapshot(to_jsonb(NEW)); END IF;
  IF TG_OP = 'UPDATE' AND previous IS NOT DISTINCT FROM current_row THEN RETURN NEW; END IF;
  row_data := coalesce(current_row, previous);
  tenant_id := row_data->>'company_id';
  IF TG_TABLE_NAME = 'Company' THEN tenant_id := row_data->>'id'; END IF;

  -- Child rows inherit their company's scope from their parent, including
  -- changes made by scripts that have no signed-in actor.
  IF tenant_id IS NULL THEN
    FOREACH parent_table IN ARRAY ARRAY['Property','Agency','Owner','Tenant','Supplier','Planning','Investment','UserGroup','User','AdjustmentIndex'] LOOP
      parent_key := CASE parent_table WHEN 'UserGroup' THEN 'user_group_id' WHEN 'AdjustmentIndex' THEN 'adjustment_index_id' ELSE lower(parent_table) || '_id' END;
      IF nullif(row_data->>parent_key, '') IS NOT NULL THEN
        EXECUTE format('SELECT company_id FROM %I WHERE id = $1', parent_table)
          INTO tenant_id USING row_data->>parent_key;
        EXIT WHEN tenant_id IS NOT NULL;
      END IF;
    END LOOP;
  END IF;
  IF tenant_id IS NULL AND TG_TABLE_NAME = 'ContactChannel' THEN
    SELECT coalesce(a.company_id, o.company_id, t.company_id, s.company_id)
      INTO tenant_id FROM "Contact" c
      LEFT JOIN "Agency" a ON a.id = c.agency_id
      LEFT JOIN "Owner" o ON o.id = c.owner_id
      LEFT JOIN "Tenant" t ON t.id = c.tenant_id
      LEFT JOIN "Supplier" s ON s.id = c.supplier_id
      WHERE c.id = row_data->>'contact_id';
  END IF;
  tenant_id := coalesce(tenant_id, actor->>'company_id');
  IF tenant_id IS NULL THEN
    -- Unowned addresses created outside a request cannot be assigned to a tenant.
    RETURN coalesce(NEW, OLD);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Company" WHERE id = tenant_id) THEN RETURN coalesce(NEW, OLD); END IF;

  SELECT id INTO actor_id FROM "User"
    WHERE id = actor->>'id' AND company_id = tenant_id;
  operation := CASE
    WHEN TG_OP = 'DELETE' THEN 'DELETE'::"AuditAction"
    WHEN TG_OP = 'INSERT' THEN 'CREATE'::"AuditAction"
    WHEN previous->>'deleted_at' IS NULL AND current_row->>'deleted_at' IS NOT NULL THEN 'DELETE'::"AuditAction"
    ELSE 'UPDATE'::"AuditAction" END;

  INSERT INTO "AuditLogOutbox" (id, company_id, user_id, user_name, user_email, action,
    table_name, record_id, old_values, new_values, ip, created_at)
  VALUES (gen_random_uuid()::text, tenant_id, actor_id,
    CASE WHEN actor_id IS NOT NULL THEN actor->>'name' ELSE 'Sistema' END,
    CASE WHEN actor_id IS NOT NULL THEN actor->>'email' END,
    operation, TG_ARGV[0], row_data->>'id', previous, current_row,
    left(actor->>'ip', 45), clock_timestamp() AT TIME ZONE 'UTC');
  RETURN coalesce(NEW, OLD);
END;
$$;

-- Repair triggers may already exist under a different name. Never duplicate them.
DO $$
DECLARE model text;
BEGIN
  FOREACH model IN ARRAY ARRAY[
    'Repair', 'RepairProfessional', 'RepairItem', 'RepairMedia',
    'AdjustmentIndexValue', 'LeaseNotification', 'LeaseExpiryReminder',
    'Favorite', 'UserColumnPreference', 'UserDashboardLayout'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = to_regclass(format('%I', model))
        AND NOT t.tgisinternal AND p.proname = 'nairim_write_audit_log'
    ) THEN
      EXECUTE format('CREATE TRIGGER nairim_audit_changes AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION nairim_write_audit_log(%L)', model, model);
    END IF;
  END LOOP;
END $$;
