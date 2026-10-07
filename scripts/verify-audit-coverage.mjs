// Uses an ephemeral PostgreSQL-compatible database; never connects to an environment.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const prismaCli = join(dirname(createRequire(import.meta.url).resolve('prisma/package.json')), 'build/index.js');

const db = new PGlite();
try {
  // Some historical tables were baselined outside versioned migrations.
  // Build a disposable schema from Prisma, then apply only the audit migrations.
  const schema = execFileSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .replaceAll('AuditLogOutbox', 'AuditLog')
    .replace(/CREATE TYPE "AuditAction" AS ENUM \(.*?\);/, `CREATE TYPE "AuditAction" AS ENUM ('LOGIN','LOGIN_FAILED','CREATE','UPDATE','DELETE');`);
  await db.exec(schema);
  for (const migration of ['20260908000000_restore_audit_trail', '20260911000000_move_logs_to_mongodb']) {
    await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  }
  for (const model of ['Repair','RepairProfessional','RepairItem','RepairMedia']) {
    await db.exec(`CREATE TRIGGER nairim_audit AFTER INSERT OR UPDATE OR DELETE ON "${model}" FOR EACH ROW EXECUTE FUNCTION nairim_write_audit_log('${model}')`);
  }
  await db.exec(readFileSync('prisma/migrations/20261007000000_complete_audit_coverage/migration.sql', 'utf8'));
  // Repeat the new migration to verify trigger installation is idempotent.
  await db.exec(readFileSync('prisma/migrations/20261007000000_complete_audit_coverage/migration.sql', 'utf8'));
  const transferSource = readFileSync('src/shared/data/table-transfer.ts', 'utf8');
  const models = [...new Set([...transferSource.matchAll(/model: '([^']+)', children: \[([^\]]*)\]/g)].flatMap(match => [match[1], ...[...match[2].matchAll(/'([^']+)'/g)].map(child => child[1])]))];
  assert.ok(models.length > 40);
  for (const model of [...models, 'Favorite', 'UserColumnPreference', 'UserDashboardLayout', 'LeaseExpiryReminder']) {
    const table = model === 'Invoice' ? 'invoices' : model;
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=to_regclass($1) AND NOT t.tgisinternal AND p.proname='nairim_write_audit_log'`, [`"${table}"`]);
    assert.equal(rows[0].n, 1, `Exactly one CRUD audit trigger on ${model}`);
  }
  await db.exec(`INSERT INTO "Company" (id,name,slug,updated_at) VALUES ('a','Empresa A','empresa-a',now()),('b','Empresa B','empresa-b',now());
    INSERT INTO "User" (id,company_id,name,email,password,birth_date,gender,updated_at) VALUES ('actor','a','Usuário','actor@example.test','NEVER_LOG_PASSWORD','1990-01-01','OTHER',now());
    INSERT INTO "Owner" (id,company_id,name,internal_code,updated_at) VALUES ('owner','a','Proprietário','OW-1',now());
    INSERT INTO "PropertyType" (id,company_id,description,updated_at) VALUES ('type','a','Casa',now());
    INSERT INTO "Property" (id,company_id,owner_id,type_id,title,bedrooms,bathrooms,half_bathrooms,garage_spaces,area_total,area_built,frontage,furnished,tax_registration,updated_at)
      VALUES ('property','a','owner','type','Casa',0,0,0,0,100,0,0,false,'T-1',now());
    INSERT INTO "Supplier" (id,company_id,legal_name,updated_at) VALUES ('supplier','a','Agnaldo',now());`);
  const actor = { id: 'actor', company_id: 'a', name: 'Usuário', email: 'actor@example.test', ip: '127.0.0.1' };
  await db.transaction(async tx => {
    await tx.query("SELECT set_config('nairim.audit_actor', $1, true)", [JSON.stringify(actor)]);
    await tx.exec(`INSERT INTO "Repair" (id,company_id,property_id,event_date,event_type,problem_type,problem_types,description,professional,service_amount,materials_amount,payment_method,payment_conditions,updated_at)
      VALUES ('repair','a','property','2025-01-01','RENOVATION','HYDRAULIC',ARRAY['HYDRAULIC','FINISHING'],'Reforma','Agnaldo',1500,5000,'PIX','À vista',now());
      INSERT INTO "RepairProfessional" (id,company_id,repair_id,supplier_id) VALUES ('professional','a','repair','supplier');
      INSERT INTO "RepairItem" (id,company_id,repair_id,description,kind,supplier_id,professional,amount) VALUES ('item','a','repair','Trocar janelas','LABOR','supplier','Agnaldo',1500);
      INSERT INTO "RepairMedia" (id,company_id,repair_id,stage,filename,url,content_type) VALUES ('media','a','repair','BEFORE','antes.jpg','https://example.test/antes.jpg','image/jpeg');
      UPDATE "RepairItem" SET amount=1600 WHERE id='item';
      DELETE FROM "RepairMedia" WHERE id='media';
      UPDATE "Repair" SET deleted_at=now() WHERE id='repair';`);
  });
  const logs = (await db.query('SELECT * FROM "AuditLogOutbox" ORDER BY created_at,id')).rows;
  for (const [model,id] of [['Repair','repair'],['RepairProfessional','professional'],['RepairItem','item'],['RepairMedia','media']]) {
    const created=logs.filter(log=>log.table_name===model && log.record_id===id && log.action==='CREATE');
    assert.equal(created.length,1); assert.equal(created[0].user_id,'actor'); assert.equal(created[0].company_id,'a'); assert.equal(created[0].ip,'127.0.0.1');
  }
  const itemUpdate=logs.find(log=>log.record_id==='item' && log.action==='UPDATE');
  assert.equal(Number(itemUpdate.old_values.amount),1500); assert.equal(Number(itemUpdate.new_values.amount),1600);
  assert.ok(logs.some(log=>log.record_id==='repair' && log.action==='DELETE'));
  assert.ok(logs.some(log=>log.record_id==='media' && log.action==='DELETE'));
  assert.ok(!JSON.stringify(logs).includes('NEVER_LOG_PASSWORD'));
  // System jobs inherit the tenant of their index even without an actor.
  await db.exec(`INSERT INTO "AdjustmentIndex" (id,company_id,code,description,updated_at) VALUES ('index-b','b','TEST','Índice B',now());
    INSERT INTO "AdjustmentIndexValue" (id,adjustment_index_id,reference_month,reference_year,monthly_rate,updated_at) VALUES ('index-value','index-b',1,2025,0.42,now());`);
  const indexLog=(await db.query(`SELECT * FROM "AuditLogOutbox" WHERE record_id='index-value'`)).rows[0];
  assert.equal(indexLog.company_id,'b'); assert.equal(indexLog.user_name,'Sistema'); assert.equal(indexLog.user_id,null);
  const before=(await db.query('SELECT count(*)::int AS n FROM "AuditLogOutbox"')).rows[0].n;
  await assert.rejects(db.transaction(async tx=>{
    await tx.query("SELECT set_config('nairim.audit_actor', $1, true)",[JSON.stringify(actor)]);
    await tx.exec(`UPDATE "RepairItem" SET amount=9999 WHERE id='item';
      INSERT INTO "AuditLogOutbox" (id,company_id,user_id,action,table_name,new_values) VALUES ('rolled-back','a','actor','IMPORT','Repair','{"record_count":1}');`);
    throw new Error('cancel');
  }));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "AuditLogOutbox"')).rows[0].n,before);
  assert.equal(Number((await db.query(`SELECT amount FROM "RepairItem" WHERE id='item'`)).rows[0].amount),1600);
  await db.exec(`INSERT INTO "AuditLogOutbox" (id,company_id,user_id,action,table_name,new_values) VALUES
    ('export','a','actor','EXPORT','Repair','{"format":"JSON","record_count":4}'),
    ('import','a','actor','IMPORT','Repair','{"format":"JSON","created_count":1,"updated_count":0}');`);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM "AuditLogOutbox" WHERE action IN ('EXPORT','IMPORT')`)).rows[0].n,2);
  console.log(`Audit coverage verified: ${models.length} transfer models, repair CRUD/media, actor/IP, system tenant, operation events, rollback and idempotency.`);
} finally { await db.close(); }
