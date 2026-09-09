// Run after generating a disposable schema with prisma migrate diff (see docs).
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
(async () => {
 const db = new PGlite();
 try {
  await db.exec(fs.readFileSync(process.argv[2] || '.tmp-e2e/audit-schema.sql', 'utf8'));
  await db.exec(fs.readFileSync('prisma/migrations/20260908000000_restore_audit_trail/migration.sql', 'utf8'));
  await db.exec(`INSERT INTO "Company" (id,name,slug,updated_at) VALUES ('company-a','Teste','teste',now());`);

  await db.exec(`INSERT INTO "User" (id,company_id,name,email,password,birth_date,gender,updated_at) VALUES ('user-a','company-a','Teste','test@example.test','NEVER_LOG_ME','1990-01-01','OTHER',now());`);
  await db.exec(`INSERT INTO "Company" (id,name,slug,updated_at) VALUES ('company-b','Outra','outra',now());`);
  const actor={id:'user-a',company_id:'company-a',name:'Teste',email:'test@example.test'};
  await db.transaction(async tx => {
   await tx.query("SELECT set_config('nairim.audit_actor', $1, true)",[JSON.stringify(actor)]);
   await tx.exec(`INSERT INTO "Owner" (id,company_id,name,internal_code,updated_at) VALUES ('owner-a','company-a','Original','OW-1',now());
    UPDATE "Owner" SET name='Editado' WHERE id='owner-a';
    INSERT INTO "PropertyType" (id,company_id,description,updated_at) VALUES ('type-a','company-a','Casa',now());
    INSERT INTO "Property" (id,company_id,owner_id,type_id,title,bedrooms,bathrooms,half_bathrooms,garage_spaces,area_total,area_built,frontage,furnished,tax_registration,updated_at)
      VALUES ('p','company-a','owner-a','type-a','Teste',0,0,0,0,100,0,0,false,'T-1',now());
    INSERT INTO "PropertyValue" (id,property_id,status,condo_fee,property_tax,updated_at) VALUES ('value-a','p','OCCUPIED',0,0,now());
    UPDATE "PropertyValue" SET status='AVAILABLE' WHERE id='value-a';`);
  });
  let logs=(await db.query('SELECT * FROM "AuditLog" ORDER BY created_at,id')).rows;
  assert.ok(!JSON.stringify(logs).includes('NEVER_LOG_ME'));
  const changed=logs.find(l=>l.table_name==='Owner' && l.action==='UPDATE');
  assert.equal(changed.user_id,'user-a');assert.equal(changed.old_values.name,'Original');assert.equal(changed.new_values.name,'Editado');
  const occupancy=logs.find(l=>l.table_name==='PropertyValue' && l.action==='UPDATE');
  assert.equal(occupancy.company_id,'company-a');assert.equal(occupancy.old_values.status,'OCCUPIED');assert.equal(occupancy.new_values.status,'AVAILABLE');
  const before=logs.length;
  await assert.rejects(db.transaction(async tx=>{
   await tx.exec(`UPDATE "Owner" SET name='Should rollback' WHERE id='owner-a';`);
   throw new Error('rollback');
  }));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "AuditLog"')).rows[0].n,before);
  assert.equal((await db.query(`SELECT name FROM "Owner" WHERE id='owner-a'`)).rows[0].name,'Editado');
  await db.exec(`UPDATE "Owner" SET updated_at=now() WHERE id='owner-a';`);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "AuditLog"')).rows[0].n,before);
  await db.exec(`UPDATE "Owner" SET deleted_at=now() WHERE id='owner-a';`);
  const deletion=(await db.query(`SELECT * FROM "AuditLog" WHERE table_name='Owner' AND action='DELETE'`)).rows[0];
  assert.equal(deletion.user_id,null);assert.equal(deletion.user_name,'Sistema');
  await db.transaction(async tx=>{
   await tx.query("SELECT set_config('nairim.audit_actor', $1, true)",[JSON.stringify(actor)]);
   await tx.exec(`INSERT INTO "Owner" (id,company_id,name,internal_code,updated_at) VALUES ('owner-b','company-b','Outro','OW-2',now());`);
  });
  const other=(await db.query(`SELECT * FROM "AuditLog" WHERE record_id='owner-b'`)).rows[0];
  assert.equal(other.company_id,'company-b');assert.equal(other.user_id,null);assert.equal(other.user_email,null);
  await db.exec(`DELETE FROM "Owner" WHERE id='owner-b';`);
  assert.equal((await db.query(`SELECT action FROM "AuditLog" WHERE record_id='owner-b' AND action='DELETE'`)).rows.length,1);
  console.log('AUDIT_OK: schema, migration, create, update, child occupancy, rollback, no-op, soft delete, tenant isolation, no actor leakage, secret exclusion');

 } finally { await db.close(); }
})().catch(e => { console.error(e.message); process.exitCode=1; });
