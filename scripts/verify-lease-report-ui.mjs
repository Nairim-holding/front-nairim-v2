import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import tailwind from '@tailwindcss/postcss';
import assert from 'node:assert/strict';

const root = process.cwd();
const fixture = path.join(root, '.tmp-e2e/lease-report');
const reports = JSON.parse(await readFile(path.join(fixture, 'reconciliation.json'), 'utf8'));
await mkdir(fixture, { recursive: true });
await writeFile(path.join(fixture, 'index.html'), '<html><body><div id="root"></div><script type="module" src="./entry.jsx"></script></body></html>');
await writeFile(path.join(fixture, 'entry.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Content from '@/app/dashboard/(cadastro)/locacoes/relatorios/content';
import '@/app/globals.css';
createRoot(document.getElementById('root')).render(<div style={{marginLeft:288}}><Content /></div>);
`);
const server = await createServer({
  configFile: false, root, resolve: { alias: { '@': path.join(root, 'src') } },
  css: { postcss: { plugins: [tailwind()] } },
  esbuild: { jsx: 'automatic' }, server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'lease-ui-fixtures', enforce: 'pre',
    resolveId(id) { if (id === 'next/link') return '\0fixture-link'; },
    load(id) {
    if (id === '\0fixture-link') return 'import {createElement} from "react"; export default function Link({href,children,...props}) { return createElement("a",{href,...props},children); }';
    const file = id.replaceAll('\\', '/');
    if (file.endsWith('/src/contexts/AuthContext.tsx')) return 'export const useAuth = () => ({user:{name:"Verificação"}});';
    if (file.endsWith('/src/contexts/MessageContext.tsx')) return 'export const useMessageContext = () => ({showMessage: console.log});';
    if (file.endsWith('/src/lib/reports/exportHelpers.ts')) return 'export const exportTableToExcel=()=>true; export const exportTableToPDF=()=>{}; export const printReportElement=()=>{};';
    if (file.endsWith('/src/server/actions/lease-report.ts')) return `const reports=${JSON.stringify(reports)}; export async function getLeaseReportAction({months}) { return {ok:true,data:reports.find(r=>r.months[0].month===months[0].month)||reports[0]}; }`;
  } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${server.resolvedUrls.local[0]}.tmp-e2e/lease-report/index.html`);
  await page.locator('button[aria-pressed="true"]').click();
  await page.getByRole('button', { name: 'Mar', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await page.getByRole('heading', { name: 'Retenções dos Aluguéis' }).count();
  await page.getByText('36.573,83', { exact: false }).first().waitFor();
  for (const width of [1920, 1440, 1366]) {
    await page.setViewportSize({ width, height: 1000 });
    const layout = await page.evaluate(() => {
      const calendar = document.querySelector('aside').getBoundingClientRect();
      const table = document.querySelector('table');
      return { calendarBottom: calendar.bottom, tableTop: table.getBoundingClientRect().top,
        bodyOverflow: document.documentElement.scrollWidth > innerWidth,
        tableOverflow: [...document.querySelectorAll('table')].some((item) => item.parentElement.scrollWidth > item.parentElement.clientWidth) };
    });
    assert.ok(layout.calendarBottom <= layout.tableTop, 'Calendário acima da tabela');
    assert.equal(layout.bodyOverflow, false, 'Sem rolagem horizontal da página');
    assert.equal(layout.tableOverflow, false, 'Tabela cabe com o menu lateral');
    await page.screenshot({ path: path.join(fixture, `ui-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Abr', exact: true }).click();
  assert.equal(await page.locator('table').count(), 0, 'Alterar o período remove resultados antigos');
  while (await page.locator('button[aria-pressed="true"]').count()) {
    await page.locator('button[aria-pressed="true"]').first().click();
  }
  await page.getByRole('button', { name: 'Jul', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await page.getByText('30.957,27', { exact: false }).first().waitFor();
  await page.getByRole('status').getByText('Confira se o saldo já está líquido de comissão', { exact: false }).waitFor();
  await page.screenshot({ path: path.join(fixture, 'ui-julho.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Calendário no topo e tabelas sem rolagem horizontal em 1920px, 1440px e 1366px.');
} finally {
  await browser?.close();
  await server.close();
}
