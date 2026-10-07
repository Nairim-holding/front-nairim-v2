import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const state = vi.hoisted(() => ({ url: '' }));
// PGlite has one physical connection; the service's concurrency limit is tested separately.
vi.mock('@prisma/adapter-pg', async importOriginal => {
  const actual = await importOriginal<typeof import('@prisma/adapter-pg')>();
  return { ...actual, PrismaPg: class extends actual.PrismaPg { constructor(config: { connectionString: string }) { super({ ...config, max: 1 }); } } };
});
vi.mock('@/infra/config/env', () => ({ env: { DATABASE_URL: state.url } }));
vi.mock('@/infra/auth/session', () => ({ assertSuperAdmin: (session: { role: string }) => { if (session.role !== 'SUPER_ADMIN') throw new Error('Root necessário'); } }));
import { runWithAuditActor } from '@/infra/database/audit-context';
import { runWithTenant } from '@/infra/database/tenant-context';
import { getTransferTable } from '@/shared/data/table-transfer';
import { parseTableTransferBundle } from '@/shared/validators/table-transfer';
// Real Prisma and PostgreSQL-compatible database, confined to an ephemeral local socket.
let db: PGlite; let server: PGLiteSocketServer;
let service: typeof import('./table-transfer-batch'); let prisma: typeof import('@/infra/database/prisma').default;
const session = { id: 'root', company_id: 'a', role: 'SUPER_ADMIN', name: 'Root', email: 'root@test.local', iat: 0, exp: 1 };
const asRoot = <T>(fn: () => Promise<T>) => runWithTenant('a', () => runWithAuditActor({ ...session, ip: '127.0.0.1' }, fn));
const table = getTransferTable('property-types')!;
const payload = { meta: { app: 'nairim', formatVersion: 1, table: table.key, company_id: 'a', exportedAt: '2026-10-07T00:00:00.000Z', counts: { PropertyType: 1 }, dependencies: [] }, data: { PropertyType: [{ id: 'type-original', company_id: 'a', description: 'Casa' }] } };
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
    CREATE FUNCTION reject_company_c() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.company_id='c' THEN RAISE EXCEPTION 'forced test rollback'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_company_c BEFORE INSERT OR UPDATE ON "PropertyType" FOR EACH ROW EXECUTE FUNCTION reject_company_c();`);
  await server.start(); state.url = `postgresql://postgres@${server.getServerConn()}/postgres?sslmode=disable`;
  service = await import('./table-transfer-batch'); prisma = (await import('@/infra/database/prisma')).default;
}, 60000);
afterAll(async () => { if(prisma)await prisma.$disconnect(); if(server)await server.stop(); if(db)await db.close(); }, 30000);
it('cópia por empresa preserva isolamento, rollback e logs reais; repetir atualiza sem duplicar', async () => {
  const first = await asRoot(() => service.importAllTableData(table, payload, 'copy-all', session));
  expect(first.results.map(row => row.ok)).toEqual([true,true,false]);
  expect((await db.query<{ company_id: string; n: number; user_id: string; ip: string }>(`SELECT company_id FROM "PropertyType" ORDER BY company_id`)).rows.map(row => row.company_id)).toEqual(['a','b']);
  const audit = (await db.query<{ company_id: string; n: number; user_id: string; ip: string }>(`SELECT company_id,user_id,ip FROM "AuditLogOutbox" WHERE action='IMPORT' ORDER BY company_id`)).rows;
  expect(audit).toEqual([{company_id:'a',user_id:'root',ip:'127.0.0.1'},{company_id:'b',user_id:'root',ip:'127.0.0.1'}]);
  expect((await db.query<{ company_id: string; n: number; user_id: string; ip: string }>(`SELECT COUNT(*)::int AS n FROM "AuditLogOutbox" WHERE company_id='c'`)).rows[0].n).toBe(0);
  await db.exec('DROP TRIGGER reject_company_c ON "PropertyType"');
  const second = await asRoot(() => service.importAllTableData(table, payload, 'copy-all', session));
  expect(second).toMatchObject({ created: 1, updated: 2 });
  const third = await asRoot(() => service.importAllTableData(table, payload, 'copy-all', session));
  expect(third).toMatchObject({ created: 0, updated: 3 });
  expect((await db.query<{ company_id: string; n: number; user_id: string; ip: string }>(`SELECT company_id,COUNT(*)::int AS n FROM "PropertyType" GROUP BY company_id ORDER BY company_id`)).rows).toEqual([{company_id:'a',n:1},{company_id:'b',n:1},{company_id:'c',n:1}]);
}, 30000);
it('exportação conjunta mantém os dados próprios e os logs ficam na empresa correta', async () => {
  const bundle = parseTableTransferBundle(JSON.parse(await asRoot(() => service.exportAllTableData(table, session))), table.key);
  expect(bundle.meta.recordCount).toBe(3);
  for(const entry of bundle.companies)expect(entry.payload.data.PropertyType.map(row => row.company_id)).toEqual([entry.company.id]);
  const logs = (await db.query<{ company_id: string; n: number; user_id: string; ip: string }>(`SELECT company_id,user_id,ip FROM "AuditLogOutbox" WHERE action='EXPORT' ORDER BY company_id`)).rows;
  expect(logs.map(row => row.company_id)).toEqual(['a','b','c']); expect(logs.every(row => row.user_id==='root'&&row.ip==='127.0.0.1')).toBe(true);
}, 30000);

it('restaura os dados próprios pelo slug com IDs de empresa diferentes entre ambientes', async () => {
  await db.exec(`UPDATE "PropertyType" SET description='Casa '||company_id`);
  const bundle = JSON.parse(await asRoot(() => service.exportAllTableData(table, session)));
  await db.exec(`UPDATE "Company" SET id='new-'||id; UPDATE "PropertyType" SET description='Alterado';`);
  const destinationSession = { ...session, company_id: 'new-a' };
  const result = await runWithTenant('new-a', () => runWithAuditActor({ ...destinationSession, ip: '127.0.0.1' }, () => service.importAllTableData(table, bundle, 'restore-all', destinationSession)));
  expect(result.results.every(row => row.ok)).toBe(true);
  expect(result).toMatchObject({ created: 0, updated: 3 });
  expect((await db.query<{ company_id: string; description: string }>(`SELECT company_id,description FROM "PropertyType" ORDER BY company_id`)).rows).toEqual([
    {company_id:'new-a',description:'Casa a'},{company_id:'new-b',description:'Casa b'},{company_id:'new-c',description:'Casa c'},
  ]);
}, 30000);
