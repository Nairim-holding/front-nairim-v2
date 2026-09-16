import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Exercise real React components with isolated server-action fixtures; no DB writes.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, '.tmp-e2e/credit-ui');
await mkdir(fixture, { recursive: true });
await writeFile(path.join(fixture, 'index.html'), '<html><body><div id="root"></div><script type="module" src="./entry.jsx"></script></body></html>');
await writeFile(path.join(fixture, 'entry.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Modal from '@/components/domain/financial/LeaseCreditReconciliationModal';
import Input from '@/components/ui/Input';
window.holidayCalls = [];
createRoot(document.getElementById('root')).render(<><Input id="uncontrolled-date" type="date" /><Modal institutions={[{value:'bank',label:'Banco teste'}]} onClose={() => {}} onCompleted={() => {}} /></>);
`);
const server = await createServer({
  configFile: false, root, resolve: { alias: { '@': path.join(root, 'src') } },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{
    name: 'credit-fixtures', enforce: 'pre',
    load(id) {
      const name = id.replaceAll('\\', '/');
      if (name.endsWith('/src/server/actions/agency.ts')) return `export async function listAgenciesAction() { return {ok:true,data:{data:[{id:'agency',trade_name:'Imobiliária teste'}]}}; }`;
      if (name.endsWith('/src/server/actions/holiday.ts')) return `
        import { automaticHolidays } from '@/core/entities/holidays';
        export async function listHolidaysAction({year}) { window.holidayCalls.push(year); return {ok:true,data:automaticHolidays(year,'SP','Garça').map((h,i)=>({...h,id:String(i),automatic:true}))}; }
        export async function createHolidayAction(input) { window.createdHoliday = input; return {ok:true,data:input}; }
        export async function deleteHolidayAction() { return {ok:true,data:null}; }
      `;
      if (name.endsWith('/src/server/actions/financial-transaction.ts')) return `
        export async function searchLeaseCreditCandidatesAction(input) { window.searchPayload = input; return {ok:true,data:[]}; }
        export async function completeLeaseCreditReconciliationAction() { return {ok:true,data:{updated_transactions:0}}; }
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${server.resolvedUrls.local[0]}.tmp-e2e/credit-ui/index.html`);
  await page.locator('#uncontrolled-date').fill('09072026');
  assert.equal(await page.locator('#uncontrolled-date').inputValue(), '09/07/2026');
  const credit = page.locator('#lease-credit-date');
  await credit.fill('09072026');
  await credit.press('Tab');
  assert.equal(await credit.inputValue(), '09/07/2026');
  await credit.focus();
  await credit.evaluate((el) => el.setSelectionRange(2, 2));
  await credit.press('Backspace');
  assert.equal(await credit.inputValue(), '0/07/2026');
  assert.equal(await credit.evaluate((el) => el.selectionStart), 1);
  await credit.press('9');
  assert.equal(await credit.inputValue(), '09/07/2026');
  assert.equal(await credit.evaluate((el) => el.selectionStart), 2);
  await credit.evaluate((el) => el.setSelectionRange(3, 3));
  await credit.press('Backspace');
  assert.equal(await credit.inputValue(), '0/07/2026');
  await credit.press('9');
  await credit.evaluate((el) => el.setSelectionRange(4, 5));
  await credit.press('Backspace');
  assert.equal(await credit.inputValue(), '09/0/2026');
  assert.equal(await credit.evaluate((el) => el.selectionStart), 4);
  await credit.press('7');
  assert.equal(await credit.inputValue(), '09/07/2026');
  const callsBefore = await page.evaluate(() => window.holidayCalls.length);
  await credit.fill('01011999');
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.equal(await page.evaluate(() => window.holidayCalls.length), callsBefore);
  await credit.press('Tab');
  assert.match(await page.getByRole('alert').innerText(), /2000/);
  assert.equal(await page.evaluate(() => window.holidayCalls.length), callsBefore);
  await credit.fill('01012026');
  assert.equal(await page.getByRole('alert').count(), 0);
  await credit.press('Tab');
  await page.getByText('Feriados de 2026', { exact: true }).click();
  assert.equal(await page.getByRole('columnheader', { name: 'Dia da semana' }).count(), 1);
  assert.match(await page.getByRole('row').filter({hasText:'Aniversário de Garça'}).innerText(), /Terça-feira.*Municipal/);
  assert.match(await page.getByRole('row').filter({hasText:'Revolução Constitucionalista'}).innerText(), /Quinta-feira.*Estadual/);
  const picker = page.getByLabel('Selecionar Data no calendário', { exact: true });
  await picker.evaluate((el) => {
    const original = el.showPicker.bind(el);
    el.showPicker = () => { window.pickerOpened = true; original(); };
  });
  await picker.click();
  assert.equal(await page.evaluate(() => window.pickerOpened), true);
  await page.keyboard.press('Escape');
  await picker.fill('2026-07-09');
  assert.equal(await page.locator('#holiday-date').inputValue(), '09/07/2026');
  // Native picker is present and wired in both directions.
  await page.locator('#holiday-date').fill('25122026');
  assert.equal(await picker.inputValue(), '2026-12-25');
  await page.locator('#holiday-date').focus();
  await page.locator('#holiday-date').evaluate((el) => el.setSelectionRange(2, 2));
  await page.locator('#holiday-date').press('Backspace');
  assert.equal(await page.locator('#holiday-date').inputValue(), '2/12/2026');
  assert.equal(await page.locator('#holiday-date').evaluate((el) => el.selectionStart), 1);
  await page.locator('#holiday-date').fill('11082026');
  await page.locator('#holiday-description').fill('Feriado de teste');
  await page.locator('span[title="Nacional"]').click();
  await page.locator('li').filter({hasText:/^Estadual$/}).click();
  await page.locator('span[title="Selecione a UF"]').click();
  await page.getByPlaceholder('Pesquisar...').fill('MG');
  await page.locator('li').filter({hasText:/^MG$/}).click();
  await page.getByRole('button', {name:'Adicionar', exact:true}).click();
  await page.waitForFunction(() => window.createdHoliday);
  assert.equal(await page.evaluate(() => window.createdHoliday.state), 'MG');
  assert.equal(await page.evaluate(() => window.createdHoliday.scope), 'STATE');
  await credit.fill('22062026');
  await page.locator('#lease-credit-amount').fill('100000');
  await page.locator('span[title="Selecione a instituição"]').click();
  await page.locator('li').filter({hasText:/^Banco teste$/}).click();
  await page.getByRole('button', {name:'Pesquisar possíveis locações'}).click();
  await page.waitForFunction(() => window.searchPayload);
  assert.deepEqual(await page.evaluate(() => window.searchPayload), { credit_date:'2026-06-22', credited_amount:1000, financial_institution_id:'bank', agency_ids:['agency'] });
  assert.deepEqual(errors, []);
  console.log('PASS: cursor, day/month editing, separator deletion, blur-only year validation, holiday grid, calendar opening/synchronization, state holiday creation and credit search payload.');
} finally {
  await browser?.close();
  await server.close();
}
