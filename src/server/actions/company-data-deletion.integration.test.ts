import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const state = vi.hoisted(() => ({ url: '', company: 'a', role: 'SUPER_ADMIN' }));
// PGlite has one physical connection; the service's concurrency limit is tested separately.
vi.mock('@prisma/adapter-pg', async importOriginal => {
  const actual = await importOriginal<typeof import('@prisma/adapter-pg')>();
  return { ...actual, PrismaPg: class extends actual.PrismaPg { constructor(config: { connectionString: string }) { super({ ...config, max: 1 }); } } };
});
vi.mock('@/infra/config/env', () => ({ env: { DATABASE_URL: state.url } }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'test-token' }) }), headers: async () => new Headers({ 'x-real-ip': '127.0.0.1' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/infra/auth/jwt-service', () => ({ jwtService: { verify: () => ({ id:'root',company_id:state.company,name:'Root',email:'root@test.local',role:state.role,iat:1,exp:9999999999 }) } }));
let db: PGlite; let server: PGLiteSocketServer; let prisma: typeof import('@/infra/database/prisma').default;
let actions: typeof import('./company-data-deletion');
let agencies: typeof import('./agency');
beforeAll(async () => {
  db = new PGlite(); server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  const prismaCli = join(dirname(createRequire(import.meta.url).resolve('prisma/package.json')), 'build/index.js');
  const schema = execFileSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://build:build@127.0.0.1:5432/build' }, timeout: 60000 }).replaceAll('AuditLogOutbox','AuditLog');
  await db.exec(schema);
  for (const migration of ['20260908000000_restore_audit_trail','20260911000000_move_logs_to_mongodb','20261007000000_complete_audit_coverage']) await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`,'utf8'));
  await db.exec(`INSERT INTO "Company" (id,name,slug,updated_at) VALUES ('a','Empresa A','empresa-a',now()),('b','Empresa B','empresa-b',now()),('c','Empresa C','empresa-c',now());
    INSERT INTO "User" (id,company_id,name,email,password,birth_date,gender,role,updated_at) VALUES ('root','a','Root','root@test.local','test-only','1990-01-01','OTHER','SUPER_ADMIN',now());

    DELETE FROM "AuditLogOutbox";
`);
  await server.start(); state.url = `postgresql://postgres@${server.getServerConn()}/postgres?sslmode=disable`;
  actions = await import('./company-data-deletion'); agencies = await import('./agency'); prisma = (await import('@/infra/database/prisma')).default;
}, 60000);
afterAll(async () => { if(prisma)await prisma.$disconnect(); if(server)await server.stop(); if(db)await db.close(); }, 30000);


import { DELETION_GROUPS } from '@/shared/data/company-data-deletion';
import { transferModels } from '@/shared/validators/table-transfer';
const all = DELETION_GROUPS.map(group => group.key);
const input = (groups: string[] = all) => ({ companyId: 'a', groups, confirmation: 'CONFIRMAR' });
const extra = ['PropertyValue','PropertyIptu','PropertyAddress','OwnerAddress','TenantAddress','AgencyAddress','SupplierAddress','PlanningMonth','InvestmentTransaction','InvestmentMonthBalance','AdjustmentIndexValue','RepairProfessional','RepairItem','RepairMedia','Contact','ContactChannel','Address'];
async function seed(company: string) {
  const models = [...new Set([...DELETION_GROUPS.flatMap(group => [...group.models]), ...extra])];
  const done = new Set<string>();
  async function insert(model: string) {
    if (done.has(model)) return;
    // No cycle except Transaction's optional self-reference.
    done.add(model);
    for (const rel of transferModels[model].relations) if (rel.model !== model && models.includes(rel.model)) await insert(rel.model);
    const values: Record<string, unknown> = { id: company + '-' + model };
    for (const field of transferModels[model].fields) {
      if ((!field.required && field.name !== 'updated_at') || field.name === 'id') continue;
      values[field.name] = field.values ? field.values[0] : field.list ? [] : field.type === 'DateTime' ? '2026-10-01' : ['Int','Float','Decimal'].includes(field.type) ? 1 : field.type === 'Boolean' ? true : field.type === 'Json' ? '{}' : 'valor-' + company;
    }
    if (transferModels[model].fields.some(field => field.name === 'company_id')) values.company_id = company;
    for (const rel of transferModels[model].relations) if (rel.model !== model && models.includes(rel.model)) values[rel.fields[0]] = company + '-' + rel.model;
    if (model === 'LeaseExpiryReminder') values.user_id = 'root';
    if (model === 'Favorite') values.user_id = 'root';
    if (model === 'Investment') values.invested_amount = 0;
    const columns = Object.keys(values);
    await db.query('INSERT INTO "' + (model === 'Invoice' ? 'invoices' : model) + '" (' + columns.map(col => '"' + col + '"').join(',') + ') VALUES (' + columns.map((_, i) => '$' + (i + 1)).join(',') + ')', Object.values(values));
  }
  for (const model of models) await insert(model);
}
it('persiste comissão ao criar/editar/reabrir, incluindo 0%, usada na validação da locação', async () => {
  await seed('a'); await seed('b');
  const data = { trade_name:'Nova',legal_name:'Nova Ltda',cnpj:'12345678000199',commission_category_id:'a-Category',commission_subcategory_id:'a-Subcategory',commission_percentage:7.5 };
  const created = await agencies.createAgencyAction(data); expect(created.ok).toBe(true); if(!created.ok)throw new Error(created.error);
  const found = await agencies.getAgencyByIdAction(created.data.id); expect(found).toMatchObject({ok:true,data:{commission_percentage:7.5}});
  const updated = await agencies.updateAgencyAction(created.data.id,{commission_percentage:0}); expect(updated.ok).toBe(true);
  expect(await agencies.getAgencyByIdAction(created.data.id)).toMatchObject({ok:true,data:{commission_percentage:0,commission_category_id:'a-Category'}});
  const { assertLeaseFinancialSetup } = await import('@/server/services/lease-financial-setup');
  const { runWithTenant } = await import('@/infra/database/tenant-context');
  await expect(runWithTenant('a', () => assertLeaseFinancialSetup('a-Property', created.data.id))).resolves.toBeUndefined();
},30000);
it('bloqueia ausência de confirmação, palavra minúscula, outra empresa, grupos inválidos e usuário comum', async () => {
  for (const confirmation of ['', 'confirmar', ' CONFIRMAR']) expect((await actions.deleteCompanyDataAction({...input(['property-types']),confirmation})).ok).toBe(false);
  expect((await actions.deleteCompanyDataAction({...input(), companyId:'b'})).ok).toBe(false);
  expect((await actions.deleteCompanyDataAction(input(['users']))).ok).toBe(false);
  state.role='DEFAULT'; await db.exec(`UPDATE "User" SET role='DEFAULT' WHERE id='root'`);
  expect((await actions.deleteCompanyDataAction(input())).ok).toBe(false);
  state.role='SUPER_ADMIN'; await db.exec(`UPDATE "User" SET role='SUPER_ADMIN' WHERE id='root'`);
  expect((await db.query(`SELECT id FROM "PropertyType" WHERE company_id='a'`)).rows.length).toBe(1);
});
it('administrador com grupo precisa da permissão de exclusão nas configurações e em cada cadastro', async () => {
  await db.exec(`INSERT INTO "UserGroup" (id,company_id,description,updated_at) VALUES ('restricted','a','Restrito',now()); UPDATE "User" SET role='ADMIN',user_group_id='restricted' WHERE id='root';`);
  state.role='ADMIN';
  expect((await actions.previewCompanyDataDeletionAction(input(['property-types']))).ok).toBe(false);
  await db.exec(`INSERT INTO "UserGroupPermission" (id,company_id,user_group_id,resource,can_delete,updated_at) VALUES ('settings-delete','a','restricted','settings',true,now());`);
  expect((await actions.previewCompanyDataDeletionAction(input(['property-types']))).ok).toBe(false);
  await db.exec(`INSERT INTO "UserGroupPermission" (id,company_id,user_group_id,resource,can_delete,updated_at) VALUES ('types-delete','a','restricted','property-types',true,now());`);
  expect((await actions.previewCompanyDataDeletionAction(input(['property-types']))).ok).toBe(true);
  await db.exec(`UPDATE "User" SET role='SUPER_ADMIN',user_group_id=null WHERE id='root'`); state.role='SUPER_ADMIN';
});
it('prévia identifica vínculos sem apagar e exclusão incompleta falha integralmente', async () => {
  const preview=await actions.previewCompanyDataDeletionAction(input(['property-types']));
  expect(preview.ok).toBe(true); if(!preview.ok)throw new Error(preview.error);
  expect(preview.data.blockers.join(' ')).toContain('Imóveis');
  expect((await actions.deleteCompanyDataAction(input(['property-types']))).ok).toBe(false);
  expect((await db.query(`SELECT id FROM "PropertyType" WHERE company_id='a'`)).rows.length).toBe(1);
});
it('bloqueia vínculos incorretos vindos de outra empresa e preserva contatos compartilhados', async () => {
  await db.exec(`UPDATE "Property" SET owner_id='a-Owner' WHERE id='b-Property'`);
  const cross=await actions.previewCompanyDataDeletionAction(input()); expect(cross.ok).toBe(true);
  if(cross.ok)expect(cross.data.blockers.join(' ')).toContain('Imóveis');
  expect((await actions.deleteCompanyDataAction(input())).ok).toBe(false);
  await db.exec(`UPDATE "Property" SET owner_id='b-Owner' WHERE id='b-Property'; UPDATE "Contact" SET owner_id='b-Owner' WHERE id='a-Contact'`);
  const shared=await actions.previewCompanyDataDeletionAction(input()); expect(shared.ok).toBe(true);
  if(shared.ok)expect(shared.data.blockers.join(' ')).toContain('Contatos compartilhados');
  await db.exec(`UPDATE "Contact" SET owner_id='a-Owner' WHERE id='a-Contact'`);
});
it('erro no meio da exclusão desfaz todos os deletes e logs da tentativa', async () => {
  await db.exec(`CREATE FUNCTION reject_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'rollback test'; END $$; CREATE TRIGGER reject_delete BEFORE DELETE ON "Owner" FOR EACH ROW EXECUTE FUNCTION reject_delete();`);
  expect((await actions.deleteCompanyDataAction(input())).ok).toBe(false);
  expect((await db.query(`SELECT id FROM "Transaction" WHERE company_id='a'`)).rows.length).toBe(1);
  expect((await db.query(`SELECT id FROM "RepairItem" WHERE company_id='a'`)).rows.length).toBe(1);
  expect((await db.query(`SELECT id FROM "AuditLogOutbox" WHERE table_name='CompanyData'`)).rows.length).toBe(0);
  await db.exec(`DROP TRIGGER reject_delete ON "Owner"; DROP FUNCTION reject_delete();`);
});
it('exclui todos os grupos e detalhes de A, preserva B, usuários, empresa e auditoria', async () => {
  const preview = await actions.previewCompanyDataDeletionAction(input());
  expect(preview.ok).toBe(true); if(!preview.ok)throw new Error(preview.error);
  expect(preview.data.blockers).toEqual([]); expect(preview.data.counts.ContactChannel).toBe(1); expect(preview.data.counts.Address).toBe(1);
  const result=await actions.deleteCompanyDataAction(input()); expect(result).toMatchObject({ok:true});
  for(const model of [...new Set([...DELETION_GROUPS.flatMap(group=>[...group.models]),...extra])]) {
    const table=model==='Invoice'?'invoices':model;
    expect((await db.query(`SELECT id FROM "${table}" WHERE id=$1`,['a-'+model])).rows, model).toEqual([]);
    expect((await db.query(`SELECT id FROM "${table}" WHERE id=$1`,['b-'+model])).rows.length, model).toBe(1);
  }
  expect((await db.query(`SELECT id FROM "User" WHERE id='root'`)).rows.length).toBe(1);
  expect((await db.query(`SELECT id FROM "Company" WHERE id='a'`)).rows.length).toBe(1);
  expect((await db.query(`SELECT id FROM "AuditLogOutbox" WHERE action='DELETE' AND table_name='CompanyData' AND user_id='root' AND company_id='a'`)).rows.length).toBe(1);
},30000);
it('múltiplos grupos independentes podem ser excluídos de uma só vez', async () => {
  await db.exec(`INSERT INTO "PropertyType" (id,company_id,description,updated_at) VALUES ('type-extra','a','Casa',now()); INSERT INTO "Holiday" (id,company_id,date,description,updated_at) VALUES ('holiday-extra','a','2026-10-19','Teste',now());`);
  expect(await actions.deleteCompanyDataAction(input(['property-types','holidays']))).toMatchObject({ok:true,data:{total:2}});
});

it('preserva endereço compartilhado com outra empresa mesmo ao limpar todos os dados operacionais', async () => {
  await seed('c'); state.company='c';
  await db.exec(`INSERT INTO "PropertyAddress" (id,property_id,address_id,updated_at) VALUES ('shared-address','b-Property','c-Address',now());`);
  const result=await actions.deleteCompanyDataAction({...input(),companyId:'c'}); expect(result).toMatchObject({ok:true});
  expect((await db.query(`SELECT id FROM "Address" WHERE id='c-Address'`)).rows.length).toBe(1);
  expect((await db.query(`SELECT id FROM "PropertyAddress" WHERE id='shared-address'`)).rows.length).toBe(1);
  state.company='a';
},30000);
