import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Exercise the real form in an isolated browser fixture. Only session contexts
// and server actions are mocked; no database or storage is contacted.
const root = realpathSync(process.cwd());
const fixture = mkdtempSync(join(root, '.repair-ui-'));
const propertyId = '00000000-0000-4000-8000-000000000001';
const agnaldoId = '00000000-0000-4000-8000-000000000002';
const storeId = '00000000-0000-4000-8000-000000000003';
let server; let browser;
try {
  writeFileSync(join(fixture, 'mocks.tsx'), `
    import React from 'react';
    const showMessage = (message, kind) => { window.__messages ??= []; window.__messages.push({ message, kind }); };
    export const useMessageContext = () => ({ showMessage });
    export const usePopupContext = () => ({ showPopup: (title, message, callback) => { window.__preview = { title, message }; window.__confirm = callback; } });
    export const usePermissions = () => ({ can: () => true });
    export const useAuth = () => ({ user: { role: 'ADMIN' } });
    export const usePathname = () => '/dashboard/reparos';
    export async function saveRepairAction(id, input) {
      window.__saved = input;
      const names = { '${agnaldoId}': 'Agnaldo da Silva', '${storeId}': 'MultLeve' };
      return { ok: true, data: { ...input, id: id ?? '${propertyId}', property: { id: '${propertyId}', title: 'Casa de teste' },
        supplier_id: input.supplier_ids[0], professional: input.supplier_ids.map(id => names[id]).join(', '),
        professionals: input.supplier_ids.map(id => ({ supplier_id: id, supplier: { id, legal_name: names[id] } })),
        items: input.items.map((item, i) => ({ ...item, id: String(i), professional: names[item.supplier_id] })), media: [] } };
    }
    export const uploadRepairMediaAction = async () => ({ ok: false, error: 'Upload indisponível no teste' });
    export const deleteRepairMediaAction = async () => ({ ok: true, data: null });
    export const quickCreateFinancialSupplierAction = async () => ({ ok: false, error: 'Cadastro rápido não usado neste cenário' });
    export const exportTableDataAction = async () => ({ ok: true, data: JSON.stringify({ meta: { table: 'repairs' }, data: { Repair: [] } }) });
    export const previewTableImportAction = async () => ({ ok: true, data: { label: 'Reparos', total: 2, counts: { Repair: 1, RepairItem: 1 }, dependencies: [] } });
    export const importTableDataAction = async (key, form) => { window.__imported = { key, payload: JSON.parse(await form.get('file').text()) }; return { ok: true, data: { created: 2, updated: 0 } }; };
    export default function ImageOrLink(props) { return props.href ? <a {...props} /> : <img {...props} />; }
  `);
  writeFileSync(join(fixture, 'main.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import RepairForm from '@/app/dashboard/reparos/_components/RepairForm';
    import Section from '@/components/layout/PageSection';
    const noop = () => {};
    createRoot(document.getElementById('root')).render(<Section title="Reparos"><div style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <RepairForm repair={null} properties={[{ id: '${propertyId}', title: 'Casa de teste' }]}
        suppliers={[{ id: '${agnaldoId}', legal_name: 'Agnaldo da Silva' }, { id: '${storeId}', legal_name: 'MultLeve' }]}
        suppliersLoading={false} onSupplierCreated={noop} readOnly={false} onClose={noop} onSaved={noop} onBusyChange={noop} />
    </div></Section>);
  `);
  const cssDirectory = join(root, '.next', 'static', 'css');
  const css = readdirSync(cssDirectory).filter(name => name.endsWith('.css')).map(name => readFileSync(join(cssDirectory, name), 'utf8')).join('\n');
  writeFileSync(join(fixture, 'style.css'), css);
  writeFileSync(join(fixture, 'index.html'), '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  const mockedModules = ['@/contexts/MessageContext', '@/contexts/PopupContext', '@/contexts/PermissionsContext', '@/contexts/AuthContext', 'next/navigation', 'next/image', 'next/link', '@/server/actions/repair', '@/server/actions/financial-supplier', '@/server/actions/table-transfer'];
  server = await createServer({ configFile: false, root: fixture, esbuild: { jsx: 'automatic' },
    resolve: { alias: [...mockedModules.map(find => ({ find, replacement: join(fixture, 'mocks.tsx') })), { find: '@', replacement: join(root, 'src') }] },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
  });
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + port);
  await page.getByRole('button', { name: 'Exportar JSON' }).waitFor();
  await page.getByTestId('repair-property').locator('[tabindex]').click();
  await page.getByText('Casa de teste', { exact: true }).last().click();
  await page.getByRole('checkbox', { name: /^Estrutural/ }).uncheck();
  await page.getByRole('checkbox', { name: /^Hidráulico/ }).check();
  await page.getByRole('checkbox', { name: /^Revestimento/ }).check();
  await page.getByLabel('Responsável 1', { exact: true }).fill('Agnaldo');
  await page.getByRole('option', { name: /Agnaldo da Silva/ }).click();
  await page.getByRole('button', { name: 'Adicionar profissional' }).click();
  await page.getByLabel('Responsável 2', { exact: true }).fill('MultLeve');
  await page.getByRole('option', { name: /MultLeve/ }).click();
  await page.locator('#repair-description').fill('Reforma dos quartos');
  await page.getByRole('button', { name: 'Adicionar item', exact: true }).click();
  const itemOne = page.getByTestId('repair-item-0');
  await itemOne.locator('input').nth(0).fill('Trocar 2 janelas dos quartos');
  await itemOne.locator('input').nth(1).fill('150000');
  await page.getByRole('button', { name: 'Adicionar item', exact: true }).click();
  const itemTwo = page.getByTestId('repair-item-1');
  await itemTwo.locator('input').nth(0).fill('Compra 2 janelas de alumínio');
  await itemTwo.locator('input').nth(1).fill('500000');
  await itemTwo.getByText('Mão de obra', { exact: true }).click();
  await page.getByText('Materiais', { exact: true }).last().click();
  await page.getByLabel('Responsável do item 2', { exact: true }).fill('MultLeve');
  await page.getByRole('option', { name: /MultLeve/ }).click();
  await page.locator('#repair-payment-method').fill('Pix');
  await page.locator('#repair-payment-conditions').fill('À vista');
  assert.match(await page.locator('#repair-service-amount').inputValue(), /1\.500,00/);
  assert.match(await page.locator('#repair-materials-amount').inputValue(), /5\.000,00/);
  assert.match(await page.locator('[aria-live="polite"]').innerText(), /6\.500,00/);
  await page.getByRole('button', { name: 'Salvar reparo' }).click();
  await page.waitForFunction(() => Boolean(window.__saved));
  const saved = await page.evaluate(() => window.__saved);
  assert.deepEqual(saved.problem_types, ['HYDRAULIC', 'FINISHING']);
  assert.deepEqual(saved.supplier_ids, [agnaldoId, storeId]);
  assert.equal(saved.items.length, 2); assert.equal(saved.items[0].amount, 1500); assert.equal(saved.items[1].amount, 5000);
  assert.equal(saved.items[1].kind, 'MATERIAL'); assert.equal(saved.items[1].supplier_id, storeId);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON' }).click();
  const download = await downloadPromise; assert.match(download.suggestedFilename(), /^nairim-repairs-.*\.json$/);
  const importedPayload = { meta: { table: 'repairs' }, data: { Repair: [{ id: 'repair' }], RepairItem: [{ id: 'item' }] } };
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({ name: 'reparos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(importedPayload)) });
  await page.waitForFunction(() => Boolean(window.__preview));
  assert.match(await page.evaluate(() => window.__preview.message), /2 registro/);
  if (process.env.REPAIR_UI_SCREENSHOT) await page.screenshot({ path: resolve(process.env.REPAIR_UI_SCREENSHOT), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'O formulário não deve transbordar a tela móvel');
  await page.evaluate(async () => window.__confirm());
  assert.deepEqual(await page.evaluate(() => window.__imported), { key: 'repairs', payload: importedPayload });
  assert.deepEqual(errors, [], 'O formulário não deve apresentar erros no navegador');
  console.log('UI aprovada: múltiplos problemas e profissionais, itens, total R$ 6.500,00, envio, exportação, confirmação de importação e layout móvel.');
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  const target = realpathSync(fixture);
  if (dirname(target) !== root || !basename(target).startsWith('.repair-ui-')) throw new Error('Diretório de teste fora do projeto; limpeza cancelada.');
  rmSync(target, { recursive: true, force: true });
}
