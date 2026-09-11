import { chromium } from 'playwright';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.LOGS_TEST_BASE_URL || 'http://localhost:3005';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const mongo = new MongoClient(process.env.MONGODB_LOGS_URI);
const marker = randomUUID();
const ids = [randomUUID(), randomUUID()];
let browser;
await db.connect(); await mongo.connect();
const logs = mongo.db(process.env.MONGODB_LOGS_DATABASE).collection('audit_logs');
try {
  const { rows: [user] } = await db.query(`SELECT id, name, email, role, company_id FROM "User"
    WHERE is_active=true AND deleted_at IS NULL AND role='SUPER_ADMIN' AND company_id IS NOT NULL LIMIT 1`);
  assert.ok(user, 'An active local super administrator is required for UI verification');
  const before = await db.query('SELECT count(*)::int AS n FROM "AuditLogOutbox"');
  await db.query('BEGIN');
  await db.query("SELECT set_config('nairim.audit_actor',$1,true)", [JSON.stringify(user)]);
  await db.query('UPDATE "Company" SET name=name || $1 WHERE id=$2', [' audit-verification', user.company_id]);
  const triggered = await db.query('SELECT count(*)::int AS n FROM "AuditLogOutbox"');
  assert.ok(triggered.rows[0].n > before.rows[0].n, 'Business updates must enqueue logs');
  await db.query('ROLLBACK');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "AuditLogOutbox"')).rows[0].n, before.rows[0].n);

  const email = `verification-${marker}@example.test`;
  await logs.insertMany(ids.map((id, i) => ({ _id: id, id, company_id: i ? `other-${marker}` : user.company_id,
    company: null, user_id: null, user_name: 'Verificação temporária', user_email: email,
    action: 'DELETE', table_name: 'Auth', record_id: null, old_values: null, new_values: null,
    ip: null, created_at: new Date('2020-01-01T12:00:00Z'), ingested_at: new Date(),
  })));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
  await context.addCookies([{ name: 'authToken', value: jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' }), url: base, httpOnly: false, sameSite: 'Lax' }]);
  await context.addInitScript(user => {
    sessionStorage.setItem('userData', JSON.stringify(user));
    localStorage.setItem('nairim.lastActivityAt', String(Date.now()));
  }, user);
  const page = await context.newPage();
  await page.goto(base + '/dashboard/configuracoes', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('heading', { name: 'Logs de auditoria', exact: true }).waitFor({ timeout: 60000 });
  await page.getByLabel('E-mail do autor').fill(email);
  const response = await context.request.get(base + '/api/logs/export?mode=all&user_email=' + encodeURIComponent(email));
  assert.equal(response.status(), 200);
  const exported = await response.json();
  assert.equal(exported.logs.length, 1); assert.equal(exported.logs[0].id, ids[0]);
  await page.getByRole('button', { name: 'Conferir expurgo', exact: true }).click();
  await page.getByText('1 logs', { exact: true }).waitFor({ timeout: 30000 });
  // Custom Select uses a portal: changing it must invalidate the previous purge preview.
  await page.locator('span[title="Por tempo de retenção"]').click();
  await page.locator('li').filter({ hasText: /^Período específico$/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Excluir 1 logs', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Selecionar período', exact: true }).click();
  const calendar = page.locator('[data-date-range-dropdown]');
  await calendar.getByRole('button', { name: '1', exact: true }).click();
  await calendar.getByRole('button', { name: '2', exact: true }).click();
  await calendar.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Limpar período' }).click();
  await page.locator('span[title="Período específico"]').click();
  await page.locator('li').filter({ hasText: /^Por tempo de retenção$/ }).click();
  await page.getByRole('button', { name: 'Conferir expurgo', exact: true }).click();
  await page.getByText('1 logs', { exact: true }).waitFor({ timeout: 30000 });
  const button = page.getByRole('button', { name: 'Excluir 1 logs', exact: true });
  assert.equal(await button.isDisabled(), true);
  await page.getByLabel('Digite EXCLUIR LOGS para confirmar').fill('EXCLUIR LOGS');
  await fs.mkdir('.tmp-e2e', { recursive: true });
  await page.screenshot({ path: '.tmp-e2e/logs-settings-desktop.png', fullPage: true });
  await button.click();
  await page.getByText('1 logs excluídos.', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal(await logs.countDocuments({ _id: ids[0] }), 0);
  assert.equal(await logs.countDocuments({ _id: ids[1] }), 1, 'Other tenant must survive purge');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTitle('Encolher menu').click();
  await page.waitForFunction(() => document.querySelector('main').getBoundingClientRect().x < 1);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('aside')).opacity === '0');
  await page.screenshot({ path: '.tmp-e2e/logs-settings-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const anonymous = await browser.newContext();
  assert.notEqual((await anonymous.request.get(base + '/api/logs/export?mode=all')).status(), 200);
  await anonymous.close();
  console.log('LOGS_UI_OK: trigger + rollback, settings, scoped JSON export, confirmation, scoped purge, anonymous denial, mobile width');
} finally {
  await db.query('ROLLBACK');
  await logs.deleteMany({ _id: { $in: ids } });
  await browser?.close(); await db.end(); await mongo.close();
}
