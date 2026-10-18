import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const state = vi.hoisted(() => ({ url: '', company: 'a' }));
// PGlite has one physical connection; the service's concurrency limit is tested separately.
vi.mock('@prisma/adapter-pg', async importOriginal => {
  const actual = await importOriginal<typeof import('@prisma/adapter-pg')>();
  return { ...actual, PrismaPg: class extends actual.PrismaPg { constructor(config: { connectionString: string }) { super({ ...config, max: 1 }); } } };
});
vi.mock('@/infra/config/env', () => ({ env: { DATABASE_URL: state.url } }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'test-token' }) }), headers: async () => new Headers({ 'x-real-ip': '127.0.0.1' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/infra/auth/jwt-service', () => ({ jwtService: { verify: () => ({ id:'root',company_id:state.company,name:'Root',email:'root@test.local',role:'SUPER_ADMIN',iat:1,exp:9999999999 }) } }));
let db: PGlite; let server: PGLiteSocketServer; let prisma: typeof import('@/infra/database/prisma').default;
let actions: typeof import('./table-transfer');
beforeAll(async () => {
  db = new PGlite(); server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  const prismaCli = join(dirname(createRequire(import.meta.url).resolve('prisma/package.json')), 'build/index.js');
  const schema = execFileSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://build:build@127.0.0.1:5432/build' }, timeout: 60000 }).replaceAll('AuditLogOutbox','AuditLog');
  await db.exec(schema);
  for (const migration of ['20260908000000_restore_audit_trail','20260911000000_move_logs_to_mongodb','20261007000000_complete_audit_coverage']) await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`,'utf8'));
  await db.exec(`INSERT INTO "Company" (id,name,slug,updated_at) VALUES ('a','Empresa A','empresa-a',now()),('b','Empresa B','empresa-b',now()),('c','Empresa C','empresa-c',now());
    INSERT INTO "User" (id,company_id,name,email,password,birth_date,gender,role,updated_at) VALUES ('root','a','Root','root@test.local','test-only','1990-01-01','OTHER','SUPER_ADMIN',now());
    INSERT INTO "PropertyType" (id,company_id,description,updated_at) VALUES ('type-original','a','Antes',now());
    DELETE FROM "AuditLogOutbox";
`);
  await server.start(); state.url = `postgresql://postgres@${server.getServerConn()}/postgres?sslmode=disable`;
  actions = await import('./table-transfer'); prisma = (await import('@/infra/database/prisma')).default;
}, 60000);
afterAll(async () => { if(prisma)await prisma.$disconnect(); if(server)await server.stop(); if(db)await db.close(); }, 30000);

for (const table of ['property-types','categories']) it(`exporta ${table} na origem e importa em outra empresa com sessão viva e logs`, async () => {
  state.company='a';
  if(table==='categories') await db.exec(`INSERT INTO "Category" (id,company_id,name,type,updated_at) VALUES ('cat-a','a','Receitas','INCOME',now()); INSERT INTO "Subcategory" (id,company_id,category_id,name,updated_at) VALUES ('sub-a','a','cat-a','Aluguéis',now());`);
  const exported=await actions.exportTableDataAction(table);
  expect(exported.ok).toBe(true); if(!exported.ok)throw new Error(exported.error);
  state.company='b';
  const form=new FormData(); form.set('file',new File([exported.data],table+'.json',{type:'application/json'}));
  expect((await actions.previewTableImportAction(table,form)).ok).toBe(true);
  const imported=await actions.importTableDataAction(table,form); expect(imported).toMatchObject({ok:true});
  expect((await actions.importTableDataAction(table,form))).toMatchObject({ok:true,data:{created:0}});
  if(table==='categories') {
    const rows=(await db.query<{company_id:string;category_company:string}>(`SELECT s.company_id,c.company_id AS category_company FROM "Subcategory" s JOIN "Category" c ON c.id=s.category_id WHERE s.company_id='b'`)).rows;
    expect(rows).toEqual([{company_id:'b',category_company:'b'}]);
  }
  expect((await db.query<{n:number}>(`SELECT count(*)::int AS n FROM "AuditLogOutbox" WHERE action='IMPORT' AND company_id='b' AND user_id='root'`)).rows[0].n).toBeGreaterThan(0);
},30000);
