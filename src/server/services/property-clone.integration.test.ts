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
vi.mock('@/infra/storage/minio-storage', () => ({ minioStorage: { copy: vi.fn(async (_url: string, folder: string) => 'https://storage.test/' + folder + '/copied.pdf'), delete: vi.fn() } }));
import { runWithAuditActor } from '@/infra/database/audit-context';
import { runWithTenant } from '@/infra/database/tenant-context';
// Real Prisma and PostgreSQL-compatible database, confined to an ephemeral local socket.
let db: PGlite; let server: PGLiteSocketServer;
let service: typeof import('./property-clone'); let investments: InstanceType<typeof import('@/infra/repositories/prisma-investments-repository').PrismaInvestmentsRepository>; let prisma: typeof import('@/infra/database/prisma').default;
const session = { id: 'root', company_id: 'a', role: 'SUPER_ADMIN', name: 'Root', email: 'root@test.local', iat: 0, exp: 1 };
const asRoot = <T>(fn: () => Promise<T>) => runWithTenant('a', () => runWithAuditActor({ ...session, ip: '127.0.0.1' }, fn));
beforeAll(async () => {
  db = new PGlite(); server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  const prismaCli = join(dirname(createRequire(import.meta.url).resolve('prisma/package.json')), 'build/index.js');
  const schema = execFileSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://build:build@127.0.0.1:5432/build' }, timeout: 60000 }).replaceAll('AuditLogOutbox','AuditLog');
  await db.exec(schema);
  for (const migration of ['20260908000000_restore_audit_trail','20260911000000_move_logs_to_mongodb','20261007000000_complete_audit_coverage']) await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`,'utf8'));
  await db.exec(`INSERT INTO "Company" (id,name,slug,updated_at) VALUES ('a','Empresa A','empresa-a',now()),('b','Empresa B','empresa-b',now()),('c','Empresa C','empresa-c',now());
    INSERT INTO "User" (id,company_id,name,email,password,birth_date,gender,role,updated_at) VALUES ('root','a','Root','root@test.local','test-only','1990-01-01','OTHER','SUPER_ADMIN',now());
    INSERT INTO "PropertyType" (id,company_id,description,updated_at) VALUES ('type-a','a','Casa',now()),('type-b','b','casa',now());
    INSERT INTO "Owner" (id,company_id,name,internal_code,updated_at) VALUES ('owner-a','a','Proprietário','001',now());
    INSERT INTO "Property" (id,company_id,owner_id,type_id,title,bedrooms,bathrooms,half_bathrooms,garage_spaces,area_total,area_built,frontage,furnished,tax_registration,updated_at)
      VALUES ('property-a','a','owner-a','type-a','Casa principal',2,1,0,1,100,80,10,false,'123',now());
    INSERT INTO "Address" (id,zip_code,street,number,district,city,state,country,updated_at) VALUES ('address-a','12345678','Rua A','1','Centro','São Paulo','SP','Brasil',now());
    INSERT INTO "PropertyAddress" (id,property_id,address_id,updated_at) VALUES ('link-a','property-a','address-a',now());
    INSERT INTO "PropertyValue" (id,property_id,status,rental_value,condo_fee,property_tax,updated_at) VALUES ('value-a','property-a','AVAILABLE',1800,100,400,now());
    INSERT INTO "PropertyIptu" (id,property_id,year,property_tax,updated_at) VALUES ('iptu-a','property-a',2026,400,now());
    INSERT INTO "Document" (id,company_id,property_id,file_path,file_type,type,updated_at) VALUES ('doc-a','a','property-a','https://storage.test/original.pdf','application/pdf','OTHER',now());
    INSERT INTO "FinancialInstitution" (id,company_id,name,updated_at) VALUES ('bank-a','a','Banco',now());
    DELETE FROM "AuditLogOutbox";`);
  await server.start(); state.url = `postgresql://postgres@${server.getServerConn()}/postgres?sslmode=disable`;
  service = await import('./property-clone'); investments = new (await import('@/infra/repositories/prisma-investments-repository')).PrismaInvestmentsRepository(); prisma = (await import('@/infra/database/prisma')).default;
}, 60000);
afterAll(async () => { if(prisma)await prisma.$disconnect(); if(server)await server.stop(); if(db)await db.close(); }, 30000);

it('clona imóveis, dependências, endereço, valores e documentos com isolamento e logs por empresa', async () => {
  const result = await asRoot(() => service.cloneProperties(['property-a'], ['a','b','c'], session));
  expect(result.every(row => row.ok)).toBe(true);
  const copies = (await db.query<{id: string; company_id: string; type_id: string; owner_company: string}>(`SELECT p.id,p.company_id,p.type_id,o.company_id AS owner_company FROM "Property" p JOIN "Owner" o ON o.id=p.owner_id WHERE p.id<>'property-a' ORDER BY p.company_id`)).rows;
  expect(copies.map(row => row.company_id)).toEqual(['a','b','c']); expect(copies.every(row => row.company_id===row.owner_company)).toBe(true);
  expect(copies[1].type_id).toBe('type-b');
  expect((await db.query<{n:number}>(`SELECT count(*)::int AS n FROM "PropertyValue"`)).rows[0].n).toBe(4);
  expect((await db.query<{n:number}>(`SELECT count(DISTINCT address_id)::int AS n FROM "PropertyAddress"`)).rows[0].n).toBe(4);
  expect((await db.query<{file_path:string}>(`SELECT file_path FROM "Document" WHERE id<>'doc-a'`)).rows.every(row=>row.file_path!=='https://storage.test/original.pdf')).toBe(true);
  const logs = (await db.query<{company_id:string;user_id:string;ip:string}>(`SELECT company_id,user_id,ip FROM "AuditLogOutbox" WHERE table_name='Property' AND action='CREATE' ORDER BY company_id`)).rows;
  expect(logs).toEqual(['a','b','c'].map(company_id=>({company_id,user_id:'root',ip:'127.0.0.1'})));
},30000);
it('recusa empresa não autorizada e imóvel de outra empresa antes de gravar', async () => {
  await expect(asRoot(()=>service.cloneProperties(['property-a'],['missing'],session))).rejects.toThrow('acesso');
  const foreign = (await db.query<{id:string}>(`SELECT id FROM "Property" WHERE company_id='b' LIMIT 1`)).rows[0].id;
  await expect(asRoot(()=>service.cloneProperties([foreign],['a'],session))).rejects.toThrow('não foi encontrado');
});
it('falha reverte a cópia inteira e limpa somente arquivos novos', async () => {
  await db.exec(`CREATE FUNCTION reject_clone() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced rollback'; END $$; CREATE TRIGGER reject_clone BEFORE INSERT ON "PropertyIptu" FOR EACH ROW EXECUTE FUNCTION reject_clone(); DELETE FROM "AuditLogOutbox";`);
  const before=(await db.query<{n:number}>(`SELECT count(*)::int AS n FROM "Property"`)).rows[0].n;
  const result=await asRoot(()=>service.cloneProperties(['property-a'],['c'],session)); expect(result[0].ok).toBe(false);
  expect((await db.query<{n:number}>(`SELECT count(*)::int AS n FROM "Property"`)).rows[0].n).toBe(before);
  expect((await db.query<{n:number}>(`SELECT count(*)::int AS n FROM "AuditLogOutbox"`)).rows[0].n).toBe(0);
  const storage=(await import('@/infra/storage/minio-storage')).minioStorage; expect(storage.delete).toHaveBeenCalledWith(expect.stringContaining('/copied.pdf'));
  await db.exec('DROP TRIGGER reject_clone ON "PropertyIptu"');
},30000);
it('editar e excluir o aporte inicial sincroniza o cadastro e não faz o valor reaparecer na grade', async () => {
  const investment=await asRoot(()=>investments.create({financial_institution_id:'bank-a',issuer:'Banco',product_type:'CDB',product:'Teste',application_date:'2024-01-01',liquidity_days:0,invested_amount:707318.13}));
  await asRoot(()=>investments.createTransaction({investment_id:investment.id,type:'CONTRIBUTION',date:'2024-01-15',amount:100}));
  const entries=await asRoot(()=>investments.listTransactions(investment.id,2024,1)); const initial=entries.find(entry=>entry.is_initial)!; expect(initial.amount).toBe(707318.13);
  await asRoot(()=>investments.updateTransaction(initial.id,{date:'2024-01-01',amount:700000}));
  expect((await asRoot(()=>investments.findById(investment.id)))!.invested_amount).toBe(700000);
  await asRoot(()=>investments.deleteTransaction(initial.id));
  expect((await asRoot(()=>investments.findById(investment.id)))!.invested_amount).toBe(0);
  expect((await asRoot(()=>investments.getDashboard({startMonth:'2024-01',endMonth:'2024-02'}))).investments[0].months[0].applied).toBe(100);
},30000);
it('saldo manual pode ser removido sem excluir investimento ou aportes', async () => {
  const investment=(await asRoot(()=>investments.list()))[0];
  await asRoot(()=>investments.setMonthBalance(investment.id,2024,7,1137238.76));
  await asRoot(()=>investments.clearMonthBalance(investment.id,2024,7));
  const dashboard=await asRoot(()=>investments.getDashboard({startMonth:'2024-07',endMonth:'2024-07'}));
  expect(dashboard.investments[0].months[0]).toMatchObject({balance:100,balance_is_manual:false});
},30000);
