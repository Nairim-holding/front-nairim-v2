import { mkdtempSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

// Actual settings dialog with isolated server actions. Does not access a database.
const root = realpathSync(process.cwd());
const fixture = mkdtempSync(join(root, '.roi-settings-ui-'));
let server; let browser;
try {
  writeFileSync(join(fixture, 'mocks.tsx'), `
    import { emptyRoiLines } from '@/core/entities/property-roi';
    export const useMessageContext = () => ({ showMessage: (text) => window.__messages.push(text) });
    window.__messages = []; window.__saves = []; window.__loadMode = 'success';
    const categories = [
      { id: 'tax', name: 'Impostos', type: 'EXPENSE', subcategories: [{ id: 'itbi', name: 'ITBI' }] },
      { id: 'cost', name: 'Custos', type: 'EXPENSE', subcategories: [{ id: 'service', name: 'Serviços' }] },
      { id: 'income', name: 'Receitas', type: 'INCOME', subcategories: [{ id: 'rent', name: 'Aluguéis' }] },
    ];
    let lines = { ...emptyRoiLines(), itbi: { category_id: 'tax', subcategory_id: 'itbi' } };
    export async function getRoiSettingsAction() {
      if (window.__loadMode === 'throw') throw new Error('Offline');
      if (window.__loadMode === 'fail') return { ok: false, error: 'Sem acesso à configuração' };
      return { ok: true, data: { categories, lines, saved: true } };
    }
    export async function saveRoiSettingsAction(input) {
      window.__saves.push(input);
      if (window.__saveError) return { ok: false, error: 'Falha ao salvar' };
      lines = structuredClone(input.lines);
      return { ok: true, data: { categories, lines, saved: true } };
    }
  `);
  writeFileSync(join(fixture, 'main.tsx'), `
    import React, { useState } from 'react'; import { createRoot } from 'react-dom/client';
    import Modal from '@/app/dashboard/(financeiro)/roi/_components/RoiSettingsModal';
    function App() {
      const [open, setOpen] = useState(false), [canEdit, setCanEdit] = useState(true);
      return <main><div style={{position:'fixed',top:0,left:0,zIndex:1000,width:40,height:40}}>Menu</div>
        <button style={{marginLeft:60}} onClick={() => setOpen(true)}>Abrir configuração</button>
        <button onClick={() => setCanEdit(!canEdit)}>Alternar permissão</button>
        {open && <Modal canEdit={canEdit} onClose={() => setOpen(false)} onSaved={() => setOpen(false)} />}
      </main>;
    }
    createRoot(document.getElementById('root')).render(<App />);
  `);
  const cssSource = join(root, 'src', 'app', 'globals.css');
  const css = await postcss([tailwindcss({ base: root })]).process(readFileSync(cssSource, 'utf8'), { from: cssSource });
  writeFileSync(join(fixture, 'style.css'), css.css);
  writeFileSync(join(fixture, 'index.html'), '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  server = await createServer({ configFile: false, root: fixture, cacheDir: join(fixture, 'vite-cache'), esbuild: { jsx: 'automatic' }, resolve: { alias: [
    ...['@/contexts/MessageContext', '@/server/actions/property-roi'].map(find => ({ find, replacement: join(fixture, 'mocks.tsx') })),
    { find: '@', replacement: join(root, 'src') },
  ] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } } });
  await server.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  const open = async () => {
    await page.getByRole('button', { name: 'Abrir configuração' }).click();
    await page.getByRole('dialog').waitFor();
  };
  const itbi = () => page.getByRole('dialog').locator('div.rounded-lg.border').filter({ has: page.getByText('Impostos (ITBI)', { exact: true }) });
  const field = index => itbi().locator('div[tabindex]').nth(index);
  await open();
  await itbi().getByText('Impostos', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[role="dialog"]').parentElement).zIndex), '1100');
  await field(1).click();
  await page.locator('li').filter({ hasText: /^Todas as subcategorias$/ }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(await page.evaluate(() => window.__saves.at(-1).lines.itbi), { category_id: 'tax', subcategory_id: null });
  await open();
  await itbi().getByText('Todas as subcategorias', { exact: true }).waitFor();
  await field(0).click();
  await page.locator('li').filter({ hasText: /^Não considerar$/ }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(await page.evaluate(() => window.__saves.at(-1).lines.itbi), { category_id: null, subcategory_id: null });
  await open();
  await field(0).click();
  await page.locator('li').filter({ hasText: /^Custos$/ }).click();
  await field(1).click();
  await page.locator('li').filter({ hasText: /^Serviços$/ }).click();
  await field(0).click();
  await page.locator('li').filter({ hasText: /^Impostos$/ }).click();
  await itbi().getByText('Todas as subcategorias', { exact: true }).waitFor();
  await page.evaluate(() => window.__saveError = true);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.waitForFunction(() => window.__messages.includes('Falha ao salvar'));
  assert.equal(await page.getByRole('dialog').count(), 1);
  await page.evaluate(() => window.__saveError = false);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  for (const mode of ['fail', 'throw']) {
    await page.evaluate(mode => window.__loadMode = mode, mode);
    await open();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Salvar', exact: true }).isDisabled(), true);
    await page.evaluate(() => window.__loadMode = 'success');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await itbi().getByText('Impostos', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await open();
  await itbi().getByText('Impostos', { exact: true }).waitFor();
  const sizing = await page.getByRole('dialog').evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
  assert.ok(sizing.scrollWidth <= sizing.width, 'Campos devem caber no modal em celular');
  if (process.env.ROI_UI_SCREENSHOT) await page.screenshot({ path: resolve(process.env.ROI_UI_SCREENSHOT) });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Alternar permissão' }).click();
  await open();
  await itbi().getByText('Impostos', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Salvar', exact: true }).count(), 0);
  assert.equal(await itbi().locator('div[tabindex]').count(), 0);
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).last().click();
  assert.deepEqual(errors, []);
  console.log('ROI aprovado: carregar/reabrir, limpar categoria/subcategoria, persistir, erro de leitura/gravação, tentar novamente, permissão e celular.');
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  const target = realpathSync(fixture);
  if (dirname(target) !== root || !basename(target).startsWith('.roi-settings-ui-')) throw new Error('Diretório de teste fora do projeto.');
  rmSync(target, { recursive: true, force: true });
}
