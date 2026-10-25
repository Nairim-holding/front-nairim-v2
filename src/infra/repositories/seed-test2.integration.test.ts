import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { assertTest2Url, demoId, seedTest2, TEST_DATABASE } from '../../../scripts/seed-test2.mjs';

let schema: string;
let db: PGlite;
const query = async (sql: string, params?: unknown[]) => { const result = await db.query(sql,params);return {...result,rowCount:result.affectedRows??0}; };
const client = {query: (sql: string, params?: unknown[]) => sql==='SELECT current_database() AS database' ? Promise.resolve({rows:[{database:TEST_DATABASE}]}) : query(sql,params)};
const options = {today:new Date('2026-10-25T12:00:00Z'),year:2026,companySlug:'nairim',adminPassword:'fixture-only-password-123456'};

beforeAll(() => {
  const cli=join(dirname(createRequire(import.meta.url).resolve('prisma/package.json')),'build/index.js');
  schema=execFileSync(process.execPath,[cli,'migrate','diff','--from-empty','--to-schema','prisma/schema.prisma','--script'],{encoding:'utf8',timeout:60000,env:{...process.env,DATABASE_URL:'postgresql://build:build@127.0.0.1:5432/build'}}).replaceAll('AuditLogOutbox','AuditLog');
},60000);
beforeEach(async () => {
  db=new PGlite();await db.exec(schema);
  for(const migration of ['20260908000000_restore_audit_trail','20260911000000_move_logs_to_mongodb','20261007000000_complete_audit_coverage'])await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`,'utf8'));
  const migration=readFileSync('prisma/migrations/20261025000000_transaction_statement_order/migration.sql','utf8');
  await db.exec(migration.match(/CREATE SEQUENCE[\s\S]*?(?=\nCREATE INDEX)/)![0]);
},30000);
afterEach(async()=>{await db.close();});

it('recusa URLs de produção, homologação, iholding e um banco real diferente do teste 2',async()=>{
  expect(()=>assertTest2Url('postgresql://u:p@postgres-test-2:5432/nairim_test2_db')).not.toThrow();
  for(const name of ['nairim_db','nairim_homolog_db','iholding_db','nairim_test2_db_extra'])expect(()=>assertTest2Url(`postgresql://u:p@db/${name}`)).toThrow('somente');
  expect(()=>assertTest2Url('')).toThrow();
  await expect(seedTest2({query},options)).rejects.toThrow('banco conectado');
  expect((await db.query('SELECT COUNT(*)::int AS n FROM "Company"')).rows[0]).toEqual({n:0});
});

it('popula relações reais, gera dados do ano e permite repetir preservando alterações e senha',async()=>{
  const first=await seedTest2(client,options);
  expect(first.credentials?.email).toBe('demo-teste2@nairim.test');
  expect(first.created).toMatchObject({Company:1,User:1,Property:6,Lease:5,Card:2,invoices:24,Investment:3,Planning:5,Repair:6});
  const {rows:[company]}=await db.query<{id:string}>('SELECT id FROM "Company"');
  const adminId=demoId(company.id,'admin');
  const {rows:[original]}=await db.query<{password:string}>('SELECT password FROM "User" WHERE id=$1',[adminId]);
  expect(await bcrypt.compare(options.adminPassword,original.password)).toBe(true);
  const propertyId=demoId(company.id,'property-0');
  await db.query('UPDATE "Property" SET title=$1 WHERE id=$2',['Editado pelo usuário',propertyId]);
  const second=await seedTest2(client,{...options,adminPassword:'other-fixture-password'});
  expect(second.totalCreated).toBe(0);expect(second.credentials).toBeNull();
  expect((await db.query('SELECT title FROM "Property" WHERE id=$1',[propertyId])).rows[0]).toEqual({title:'Editado pelo usuário'});
  expect((await db.query('SELECT password FROM "User" WHERE id=$1',[adminId])).rows[0]).toEqual(original);
  expect((await db.query<{n:number}>('SELECT COUNT(*)::int AS n FROM "Transaction" WHERE status=\'COMPLETED\' AND statement_order IS NULL')).rows[0].n).toBe(0);
  expect((await db.query<{n:number}>('SELECT COUNT(*)::int AS n FROM "AuditLogOutbox"')).rows[0].n).toBeGreaterThan(0);
  expect((await db.query<{n:number}>('SELECT COUNT(*)::int AS n FROM "Transaction" t JOIN "Lease" l ON l.id=t.lease_id WHERE t.effective_date>l.end_date')).rows[0].n).toBe(0);
  expect((await db.query('SELECT COUNT(*)::int AS n FROM "InvestmentMonthBalance" WHERE year=2026')).rows[0]).toEqual({n:36});
},30000);

it('mantém usuários/configurações e não grava em outra empresa por engano',async()=>{
  await db.exec(`INSERT INTO "Company" (id,name,slug,updated_at) VALUES ('company-a','Empresa A','nairim',now()),('company-b','Empresa B','outra',now());
    INSERT INTO "User" (id,company_id,name,email,password,birth_date,gender,role,updated_at) VALUES ('user-a','company-a','Usuário existente','existing@example.test','original-hash','1990-01-01','OTHER','ADMIN',now());
    INSERT INTO "InvestmentSettings" (id,company_id,independence_reference_amount,updated_at) VALUES ('settings-a','company-a',12345,now());`);
  const result=await seedTest2(client,options);expect(result.credentials).toBeNull();
  expect((await db.query('SELECT password FROM "User" WHERE id=\'user-a\'')).rows[0]).toEqual({password:'original-hash'});
  expect((await db.query('SELECT independence_reference_amount::text AS amount FROM "InvestmentSettings" WHERE id=\'settings-a\'')).rows[0]).toEqual({amount:'12345.00'});
  expect((await db.query('SELECT COUNT(*)::int AS n FROM "Property" WHERE company_id=\'company-b\'')).rows[0]).toEqual({n:0});
  await db.exec(`UPDATE "Company" SET slug='financeiro' WHERE id='company-a'; UPDATE "Company" SET is_active=false WHERE id='company-b'`);
  const auto=await seedTest2(client,{...options,companySlug:undefined,preferredSlug:'nairim'});
  expect(auto.company).toBe('financeiro');expect(auto.totalCreated).toBe(0);
  await expect(seedTest2(client,{...options,companySlug:'inexistente'})).rejects.toThrow('não encontrada');
},30000);

it('uma falha no meio reverte todos os registros inseridos',async()=>{
  const failing={query:(sql:string,params?:unknown[])=>{if(sql.startsWith('INSERT INTO "Card"'))throw new Error('Falha simulada');return client.query(sql,params);}};
  await expect(seedTest2(failing,options)).rejects.toThrow('Falha simulada');
  for(const table of ['Company','User','Property','Transaction','AuditLogOutbox'])expect((await db.query(`SELECT COUNT(*)::int AS n FROM "${table}"`)).rows[0]).toEqual({n:0});
},30000);
