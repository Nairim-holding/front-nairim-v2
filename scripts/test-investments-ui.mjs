import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Real page and form, with isolated session/server actions. No database writes.
const root = realpathSync(process.cwd());
const fixture = mkdtempSync(join(root, '.investments-ui-'));
let server; let browser;
try {
  const actionNames = ['deleteInvestmentAction', 'updateInvestmentAction', 'createInvestmentTransactionAction', 'updateInvestmentTransactionAction',
    'deleteInvestmentTransactionAction', 'listInvestmentTransactionsAction', 'saveInvestmentSettingsAction', 'reorderInvestmentsAction',
    'setInvestmentMonthBalanceAction', 'updateInvestmentNotesAction', 'quickCreateFinancialInstitutionAction', 'createFinancialInstitutionAction',
    'exportTableDataAction', 'previewTableImportAction', 'importTableDataAction'];
  writeFileSync(join(fixture, 'mocks.tsx'), `
    import React from 'react';
    import { buildSummary, resolveInvestmentHistory, expandMonths } from '@/core/use-cases/investment/dashboard-math';
    const showMessage = (message, kind) => { window.__messages ??= []; window.__messages.push({ message, kind }); };
    export const useMessageContext = () => ({ showMessage });
    export const usePopupContext = () => ({ showPopup: () => {} });
    export const usePermissions = () => ({ can: () => true });
    export const useAuth = () => ({ user: { id: 'user', company_id: 'company', role: 'ADMIN' } });
    export const usePathname = () => '/dashboard/investimentos';
    const products = [
      { id: 'pgbl', product: 'PGBL – Classico IV FIC Renda Fixa', invested_amount: 1137238.76, final: 1148951.94 },
      { id: 'vgbl', product: 'VGBL – Classico IV FIC Renda Fixa', invested_amount: 707318.13, final: 714603.27 },
    ].map(p => ({ ...p, company_id: 'company', financial_institution_id: 'bank', financial_institution_name: 'Banco de teste',
      institution_label: 'Banco de teste - Principal', partition: 'Principal', issuer: 'Emissor de teste', product_type: 'PREVIDENCIA',
      application_date: '2024-01-01', maturity_date: '2030-01-01', liquidity_days: 0, liquidity_at_maturity: false,
      notes: 'Observação de teste', display_order: 1, liquidated_at: null, is_active: true }));
    export async function getInvestmentDashboardAction() {
      const months = expandMonths('2025-01', '2025-01');
      const histories = products.map(p => resolveInvestmentHistory(p.application_date, p.invested_amount, [], new Map([['2025-01', p.final]]), '2025-01'));
      return { ok: true, data: { start_month: '2025-01', end_month: '2025-01', months,
        summary: buildSummary(months, histories, 20000), investments: products.map(p => ({ ...p, months: [{ year: 2025, month: 1, applied: 0, balance: p.final, balance_is_manual: true }] })),
        planned_expenses_current_month: 0, independence_reference_amount: 20000, independence_base: 20000 } };
    }
    export const getInvestmentFiltersAction = async () => ({ ok: true, data: { filters: [], operators: {}, searchFields: [] } });
    export const listFinancialInstitutionsAction = async () => ({ ok: true, data: { data: [{ id: 'bank', name: 'Banco de teste' }] } });
    export const createInvestmentAction = async input => { window.__created = input; return { ok: true, data: { ...input, id: 'new' } }; };
    export const getColumnPreferencesAction = async () => ({ ok: true, data: JSON.parse(localStorage.getItem('columns') ?? '{"columnOrder":[],"visibleColumns":[],"columnWidths":{}}') });
    export const saveColumnPreferencesAction = async input => { window.__preferences = input; localStorage.setItem('columns', JSON.stringify(input)); return { ok: true, data: input }; };
    ${actionNames.map(name => `export const ${name} = async () => ({ ok: true, data: [] });`).join('\n')}
    export default function Link(props) { return <a {...props} />; }
  `);
  writeFileSync(join(fixture, 'main.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import InvestmentsPageContent from '@/app/dashboard/(financeiro)/investimentos/content';
    createRoot(document.getElementById('root')).render(<InvestmentsPageContent />);
  `);
  const cssDirectory = join(root, '.next', 'static', 'css');
  const css = readdirSync(cssDirectory).filter(name => name.endsWith('.css')).map(name => readFileSync(join(cssDirectory, name), 'utf8')).join('\n');
  writeFileSync(join(fixture, 'style.css'), css);
  writeFileSync(join(fixture, 'index.html'), '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  const mockedModules = ['@/contexts/MessageContext', '@/contexts/PopupContext', '@/contexts/PermissionsContext', '@/contexts/AuthContext', '@/contexts',
    'next/navigation', 'next/link', '@/server/actions/investment', '@/server/actions/financial-institution', '@/server/actions/user-preferences', '@/server/actions/table-transfer'];
  server = await createServer({ configFile: false, root: fixture, esbuild: { jsx: 'automatic' },
    resolve: { alias: [...mockedModules.map(find => ({ find, replacement: join(fixture, 'mocks.tsx') })), { find: '@', replacement: join(root, 'src') }] },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  await page.getByText('18.998,32', { exact: true }).waitFor();
  await page.getByText('94,99%', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Exibir e ordenar colunas' }).click();
  await page.getByRole('checkbox', { name: 'Exibir Observações' }).uncheck();
  const row = label => page.locator('[draggable="true"]').filter({ has: page.getByText(label, { exact: true }) });
  await row('Produto').getByTitle('Mover para cima').click();
  await row('Produto').getByTitle('Mover para cima').click();
  await row('Emissor').getByTitle('Mover para cima').click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__preferences));
  const desired = ['Produto', 'Emissor', 'Instituição', 'Vencimento'];
  const headers = () => page.locator('thead tr').last().locator('th').allTextContents();
  assert.deepEqual((await headers()).filter(text => text && text !== 'Jan 2025'), desired);
  assert.deepEqual(await page.locator('tbody tr').first().locator('td').allTextContents(), [
    '', 'PGBL – Classico IV FIC Renda Fixa', 'Emissor de teste', 'Banco de teste - Principal', '01/01/2030', 'Aplicado', '',
  ]);
  await page.reload();
  await page.getByText('18.998,32', { exact: true }).waitFor();
  assert.deepEqual((await headers()).filter(text => text && text !== 'Jan 2025'), desired);
  if (process.env.INVESTMENTS_UI_SCREENSHOT) await page.screenshot({ path: resolve(process.env.INVESTMENTS_UI_SCREENSHOT), fullPage: true });
  // Hiding all data columns must leave summary labels/month actions usable,
  // and the explicit empty visibility list must survive reopening/reloading.
  await page.getByRole('button', { name: 'Exibir e ordenar colunas' }).click();
  for (const label of desired) await page.getByRole('checkbox', { name: 'Exibir ' + label }).uncheck();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.reload();
  await page.getByText('18.998,32', { exact: true }).waitFor();
  assert.deepEqual((await headers()).filter(Boolean), ['Jan 2025']);
  await page.getByRole('button', { name: 'Exibir e ordenar colunas' }).click();
  assert.equal(await page.locator('input[type="checkbox"]:checked').count(), 0);
  for (const label of desired) await page.getByRole('checkbox', { name: 'Exibir ' + label }).check();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('button', { name: 'Novo investimento' }).click();
  // Copy the existing product's required fields while keeping the default zero.
  await page.locator('[tabindex="0"]').first().click();
  await page.getByText(/Banco de teste - Principal \| Emissor de teste \| PGBL/).click();
  await page.locator('input[type="date"]').first().fill('2025-01-01');
  assert.match(await page.getByPlaceholder('0,00', { exact: true }).inputValue(), /0,00/);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__created));
  assert.equal(await page.evaluate(() => window.__created.invested_amount), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'A página deve conter a rolagem horizontal dentro da tabela');
  assert.deepEqual(errors, [], 'A página não deve apresentar erros no navegador');
  console.log('UI aprovada: cadastro R$ 0,00; rendimento R$ 18.998,32; ocultar, ordenar e restaurar colunas; todas ocultas; layout móvel.');
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  const target = realpathSync(fixture);
  if (dirname(target) !== root || !basename(target).startsWith('.investments-ui-')) throw new Error('Diretório de teste fora do projeto; limpeza cancelada.');
  rmSync(target, { recursive: true, force: true });
}
