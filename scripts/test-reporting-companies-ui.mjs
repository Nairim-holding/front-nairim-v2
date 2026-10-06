import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
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
    function Body() { const { companyIds } = useReportingCompanies(); return <><ReportingCompanyFilter /><output data-scope>{JSON.stringify(companyIds)}</output></>; }
    function App() { const [user, setUser] = useState({ id: 'root', company_id: 'a', role: 'SUPER_ADMIN' });
      return <Auth.Provider value={{ user }}><button onClick={() => setUser({ ...user, company_id: 'b' })}>Trocar empresa atual</button><button onClick={() => setUser({ id: 'admin', company_id: 'a', role: 'ADMIN' })}>Entrar como administrador</button><ReportingCompaniesProvider><Body /></ReportingCompaniesProvider></Auth.Provider>; }
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
  console.log('UI aprovada: seleção root, aplicação ao concluir, busca, empresa atual, empresas inativas e tela móvel.');
} finally {
  if (browser) await browser.close(); if (server) await server.close();
  const target = realpathSync(fixture);
  if (dirname(target) !== root || !basename(target).startsWith('.reporting-ui-')) throw new Error('Limpeza fora do projeto cancelada.');
  rmSync(target, { recursive: true, force: true });
}
