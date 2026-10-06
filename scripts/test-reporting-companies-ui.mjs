import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root = realpathSync(process.cwd());
const fixture = mkdtempSync(join(root, '.reporting-ui-'));
let server; let browser;
try {
  writeFileSync(join(fixture, 'mocks.tsx'), `
    import React, { createContext, useContext } from 'react';
    export const Auth = createContext(null);
    export const useAuth = () => useContext(Auth);
    export async function listAccessibleCompaniesAction() { window.__companyCalls = (window.__companyCalls ?? 0) + 1;
      return { ok: true, data: [{ id: 'a', name: 'Empresa Atual', is_active: true }, { id: 'b', name: 'Empresa B', is_active: true }, { id: 'c', name: 'Empresa C', is_active: true }, { id: 'd', name: 'Inativa', is_active: false }] }; }
  `);
  writeFileSync(join(fixture, 'main.tsx'), `
    import React, { useState } from 'react'; import { createRoot } from 'react-dom/client';
    import { Auth } from './mocks'; import { ReportingCompaniesProvider, ReportingCompanyFilter, useReportingCompanies } from '@/components/reports/ReportingCompanies';
    import DashboardFilter from '@/components/filters/DashboardFilter';
    function Body() { const { companyIds } = useReportingCompanies(); return <section className="p-3 min-h-screen"><DashboardFilter filter="financial" setFilter={() => {}} /><output data-scope className="sr-only">{JSON.stringify(companyIds)}</output><div className="h-[600px] rounded-xl border border-ui-border bg-surface-subtle p-4">Conteúdo do painel</div></section>; }
    function App() { const [user, setUser] = useState({ id: 'root', company_id: 'a', role: 'SUPER_ADMIN' });
      return <Auth.Provider value={{ user }}><div style={{ '--page-header-offset': '4rem' }}><button aria-label="Expandir menu" className="fixed top-2 left-4 z-[900] h-11 w-11 rounded-xl border border-ui-border bg-surface">☰</button><ReportingCompaniesProvider><Body /></ReportingCompaniesProvider><button onClick={() => setUser({ ...user, company_id: 'b' })}>Trocar empresa atual</button><button onClick={() => setUser({ id: 'admin', company_id: 'a', role: 'ADMIN' })}>Entrar como administrador</button></div></Auth.Provider>; }
    createRoot(document.getElementById('root')).render(<App />);
  `);
  const cssDirectory = join(root, '.next', 'static', 'css');
  writeFileSync(join(fixture, 'style.css'), readdirSync(cssDirectory).filter(name => name.endsWith('.css')).map(name => readFileSync(join(cssDirectory, name), 'utf8')).join('\n'));
  writeFileSync(join(fixture, 'index.html'), '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  server = await createServer({ configFile: false, root: fixture, esbuild: { jsx: 'automatic' }, resolve: { alias: [
    ...['@/contexts/AuthContext', '@/server/actions/company'].map(find => ({ find, replacement: join(fixture, 'mocks.tsx') })), { find: '@', replacement: join(root, 'src') }] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } } });
  await server.listen(); browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  const verifyLayout = async () => {
    const menu = await page.getByRole('button', { name: 'Expandir menu' }).boundingBox();
    const selector = await page.getByRole('button', { name: 'Empresas', exact: true }).boundingBox();
    const heading = await page.getByText('Painel Financeiro', { exact: true }).boundingBox();
    assert.ok(selector.x >= menu.x + menu.width || selector.y >= menu.y + menu.height, 'O seletor deve ficar fora da área do botão do menu');
    assert.ok(heading.y <= 28, 'O título deve começar no topo, sem uma linha vazia antes dele');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.getByRole('button', { name: 'Empresas', exact: true }).click();
    const panel = await page.locator('[data-reporting-company-panel]').boundingBox();
    const viewport = page.viewportSize();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= viewport.width, 'A lista de empresas deve caber dentro da tela');
    await page.getByRole('button', { name: 'Concluir' }).click();
    return { selector, heading };
  };
  await verifyLayout();
  await page.setViewportSize({ width: 1920, height: 1080 });
  const desktop = await verifyLayout();
  assert.ok(Math.abs(desktop.selector.y - desktop.heading.y) < 12, 'No desktop, empresas e título devem estar na mesma linha');
  if (process.env.REPORTING_UI_SCREENSHOT) await page.screenshot({ path: resolve(process.env.REPORTING_UI_SCREENSHOT) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Empresas', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Empresa B' }).check();
  assert.equal(await page.locator('[data-scope]').textContent(), '[]', 'Seleção deve ser aplicada uma única vez ao concluir');
  assert.equal(await page.getByRole('checkbox', { name: 'Inativa' }).count(), 0);
  await page.getByRole('button', { name: 'Concluir' }).click();
  assert.equal(await page.locator('[data-scope]').textContent(), '["a","b"]');
  await page.getByRole('button', { name: 'Empresas', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar empresa' }).fill('Empresa C');
  await page.getByTitle('Marcar todos').click(); await page.getByRole('button', { name: 'Concluir' }).click();
  assert.equal(await page.locator('[data-scope]').textContent(), '["a","b","c"]', 'Busca deve preservar as seleções fora do resultado');
  await page.getByRole('button', { name: 'Trocar empresa atual' }).click();
  assert.equal(await page.locator('[data-scope]').textContent(), '[]');
  await page.getByRole('button', { name: 'Empresas', exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Atual', exact: true }).isChecked(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole('button', { name: 'Entrar como administrador' }).click();
  assert.equal(await page.getByRole('button', { name: 'Empresas', exact: true }).count(), 0);
  assert.equal(await page.locator('[data-scope]').textContent(), '[]'); assert.deepEqual(errors, []);
  console.log('UI aprovada: seleção root, busca, empresa atual, empresas inativas, título compacto, menu sem sobreposição e lista dentro da tela no desktop e celular.');
} finally {
  if (browser) await browser.close(); if (server) await server.close();
  const target = realpathSync(fixture);
  if (dirname(target) !== root || !basename(target).startsWith('.reporting-ui-')) throw new Error('Limpeza fora do projeto cancelada.');
  rmSync(target, { recursive: true, force: true });
}
