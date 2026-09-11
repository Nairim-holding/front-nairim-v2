-- Preserve every existing row as a pending delivery; worker deletes only after durable MongoDB acknowledgement.
BEGIN;
ALTER TABLE "AuditLog" RENAME TO "AuditLogOutbox";
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='"AuditLogOutbox"'::regclass AND contype='f' LOOP
 EXECUTE format('ALTER TABLE "AuditLogOutbox" DROP CONSTRAINT %I',item.conname);
 END LOOP;
END $$;
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
    FOREACH parent_table IN ARRAY ARRAY['Property','Agency','Owner','Tenant','Supplier','Planning','Investment','UserGroup','User'] LOOP
      parent_key := CASE parent_table WHEN 'UserGroup' THEN 'user_group_id' ELSE lower(parent_table) || '_id' END;
      IF nullif(row_data->>parent_key, '') IS NOT NULL THEN
        EXECUTE format('SELECT company_id FROM %I WHERE id = $1', parent_table)
          INTO tenant_id USING row_data->>parent_key;
        EXIT WHEN tenant_id IS NOT NULL;
      END IF;
    END LOOP;
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

DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT indexname FROM pg_indexes WHERE tablename='AuditLogOutbox' AND indexname LIKE 'AuditLog_%' LOOP
 EXECUTE format('ALTER INDEX %I RENAME TO %I',item.indexname,replace(item.indexname,'AuditLog_','AuditLogOutbox_'));
 END LOOP;
END $$;
COMMIT;
