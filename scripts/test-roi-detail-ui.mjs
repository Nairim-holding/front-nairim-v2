import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import * as XLSX from 'xlsx';
import { extractText } from 'unpdf';

// Real ROI page, dialogs, table and export helpers; isolated session/actions.
// The fixtures are intentionally kept under the existing ignored scratch folder.
const root = realpathSync(process.cwd());
const scratch = join(root, '.tmp-e2e');
mkdirSync(scratch, { recursive: true });
const fixture = mkdtempSync(join(scratch, 'roi-detail-ui-'));
let server;
let browser;

try {
  writeFileSync(join(fixture, 'mocks.tsx'), `
    import React from 'react';
    import { computePropertyRoi, emptyRoiLines } from '@/core/entities/property-roi';
    import { ROI_METRIC_DEFINITIONS } from '@/core/entities/property-roi-origin';
    const showMessage = (message, kind) => window.__messages.push({ message, kind });
    export const useMessageContext = () => ({ showMessage });
    export const usePermissions = () => ({ can: () => true });
    export const useAuth = () => ({ user: { id: 'user', name: 'Pessoa de teste', company_id: 'company', role: 'ADMIN' } });
    window.__messages = []; window.__exports = []; window.__reportCount = 1;
    window.__originMode = 'success'; window.__originCalls = []; window.__pendingOrigins = [];
    const rows = [
      { propertyId: 'property-1', propertyTitle: 'Casa Centro', purchaseDate: '2020-01-01', monthsLeased: 12, rentReceived: 24000,
        ...computePropertyRoi({ purchaseValue: 300000, vacancyMonths: 1, monthsLeased: 12, rentReceived: 24000,
          itbi: 6000, registry: 2000, initialRenovation: 10000, iptu: 1200, insurance: 300, commission: 1200, periodicMaintenance: 500, periodMonths: 12 }), warnings: [] },
      { propertyId: 'property-2', propertyTitle: 'Sala Comercial', purchaseDate: '2021-02-01', monthsLeased: 12, rentReceived: 36000,
        ...computePropertyRoi({ purchaseValue: 500000, vacancyMonths: 0, monthsLeased: 12, rentReceived: 36000,
          itbi: 10000, registry: 3000, initialRenovation: 5000, iptu: 2400, insurance: 500, commission: 1800, periodicMaintenance: 800, periodMonths: 12 }), warnings: [] },
    ];
    export async function getRoiReportAction(input) {
      const visible = rows.slice(0, window.__reportCount).filter(row => !input.propertyIds?.length || input.propertyIds.includes(row.propertyId));
      return { ok: true, data: { rows: visible, period: { from: input.from, to: input.to, months: 12 },
        missingLines: [], usingSuggestedLines: false, availableProperties: rows.map(row => ({ id: row.propertyId, title: row.propertyTitle })) } };
    }
    const metricLabel = metric => ROI_METRIC_DEFINITIONS[metric].label;
    function origin(input, marker = '') {
      const properties = rows.filter(row => input.propertyIds.includes(row.propertyId));
      const unit = ROI_METRIC_DEFINITIONS[input.metric].unit;
      return { metric: input.metric, title: metricLabel(input.metric), formula: 'Fluxo de caixa anual ÷ investimento inicial',
        value: properties.reduce((sum, row) => sum + (row[input.metric] ?? 0), 0), unit,
        period: { from: input.from, to: input.to, months: 12 }, warnings: [],
        properties: properties.map(row => ({ propertyId: row.propertyId, propertyTitle: row.propertyTitle, value: row[input.metric],
          formula: 'Aluguéis recebidos ÷ meses de locação', warnings: [],
          components: [{ key: 'rentReceived', label: 'Aluguéis recebidos', value: row.rentReceived, unit: 'currency' },
            { key: 'monthsLeased', label: 'Meses de locação', value: row.monthsLeased, unit: 'months' }],
          sources: [
            { kind: 'property', id: row.propertyId, valueId: 'value-' + row.propertyId, fields: [
              { key: 'purchaseValue', label: 'Valor de compra', value: row.purchaseValue, unit: 'currency' },
              { key: 'purchaseDate', label: 'Data da compra', value: row.purchaseDate, unit: 'date' },
              { key: 'vacancyMonths', label: 'Vacância anual', value: row.vacancyMonths, unit: 'months' }] },
            { kind: 'transaction', id: 'entry-' + row.propertyId, date: '2026-03-01', eventDate: '2026-03-05',
              description: marker || 'Aluguel recebido março', amount: 2000, lineKeys: ['rent'], category: { id: 'income', name: 'Receitas' },
              subcategory: { id: 'rent', name: 'Aluguel' }, center: { id: 'center-' + row.propertyId, name: 'Centro ' + row.propertyTitle },
              institution: { id: 'bank', name: 'Banco de teste' } },
            { kind: 'lease', id: 'lease-' + row.propertyId, contractNumber: '4169/23', start: '2025-01-01', end: '2026-12-31', canceledAt: '2026-08-01', consideredEnd: '2026-08-01' },
          ] })) };
    }
    export async function getRoiOriginAction(input) {
      window.__originCalls.push(structuredClone(input));
      if (window.__originMode === 'throw') throw new Error('Conexão de origem indisponível');
      if (window.__originMode === 'fail') return { ok: false, error: 'Não foi possível consultar a origem' };
      if (window.__originMode === 'defer') return new Promise(resolve => window.__pendingOrigins.push({ input, resolve: marker => resolve({ ok: true, data: origin(input, marker) }) }));
      return { ok: true, data: origin(input) };
    }
    export const getRoiSettingsAction = async () => ({ ok: true, data: { lines: emptyRoiLines(), saved: true, categories: [] } });
    export const saveRoiSettingsAction = async () => ({ ok: true, data: { lines: emptyRoiLines(), saved: true, categories: [] } });
    export const auditPreparedExportAction = async input => { window.__exports.push(input); return { ok: true }; };
    export const getMyBrandingAction = async () => ({ ok: true, data: { company_name: 'Empresa de teste' } });
    export default function Link(props) { return <a {...props} />; }
  `);
  writeFileSync(join(fixture, 'transfer.tsx'), 'export default function TableTransferActions() { return null; }');
  writeFileSync(join(fixture, 'main.tsx'), `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import RoiContent from '@/app/dashboard/(financeiro)/roi/content';
    createRoot(document.getElementById('root')).render(<RoiContent />);
  `);
  const cssSource = join(root, 'src', 'app', 'globals.css');
  const css = await postcss([tailwindcss({ base: root })]).process(readFileSync(cssSource, 'utf8'), { from: cssSource });
  writeFileSync(join(fixture, 'style.css'), css.css);
  writeFileSync(join(fixture, 'index.html'), '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  const mockedModules = ['@/contexts/MessageContext', '@/contexts/PermissionsContext', '@/contexts/AuthContext', 'next/link',
    '@/server/actions/property-roi', '@/server/actions/export-audit', '@/server/actions/company'];
  server = await createServer({ configFile: false, root: fixture, cacheDir: join(fixture, 'vite-cache'), esbuild: { jsx: 'automatic' },
    define: { 'process.env.NEXT_PUBLIC_CARTO_API_KEY': '""' },
    resolve: { alias: [
      { find: '@/components/table/TableTransferActions', replacement: join(fixture, 'transfer.tsx') },
      ...mockedModules.map(find => ({ find, replacement: join(fixture, 'mocks.tsx') })), { find: '@', replacement: join(root, 'src') },
    ] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } } });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);

  const detailButton = () => page.getByRole('button', { name: 'Ver detalhamento do ROI de Casa Centro', exact: true });
  const valueButton = label => page.getByRole('button', { name: 'Ver origem de ' + label + ' de Casa Centro', exact: true });
  const modal = () => page.getByRole('dialog');
  const close = async () => {
    await modal().getByRole('button', { name: 'Fechar detalhamento do ROI', exact: true }).click();
    await modal().waitFor({ state: 'detached' });
  };

  await detailButton().waitFor();
  assert.equal(await modal().count(), 0, 'Um único imóvel não deve abrir o modal automaticamente');
  assert.equal(await page.getByRole('heading', { name: /Como o ROI é calculado/ }).count(), 0, 'O detalhamento não deve aparecer abaixo da tabela');
  await detailButton().click();
  await modal().getByRole('heading', { name: 'Detalhamento do ROI', exact: true }).waitFor();
  await modal().getByText('1. Investimento inicial (saídas de caixa)', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)), true, 'O foco deve entrar no modal');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)), true, 'Shift+Tab deve permanecer no modal');
  const detailMetrics = await modal().locator('button[data-roi-metric]').evaluateAll(elements => elements.map(element => element.getAttribute('data-roi-metric')));
  assert.equal(detailMetrics.length, 19, 'Todos os valores do detalhamento devem permitir abrir a origem');
  for (const metric of detailMetrics) {
    await modal().locator('button[data-roi-metric="' + metric + '"]').click();
    await modal().getByText('Aluguel recebido março', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__originCalls.at(-1).metric), metric);
    assert.deepEqual(await page.evaluate(() => window.__originCalls.at(-1).propertyIds), ['property-1']);
    await modal().getByRole('button', { name: 'Voltar ao detalhamento', exact: true }).click();
    await modal().getByRole('heading', { name: 'Detalhamento do ROI', exact: true }).waitFor();
  }
  await page.keyboard.press('Escape');
  await modal().waitFor({ state: 'detached' });
  assert.equal(await detailButton().evaluate(el => el === document.activeElement), true, 'Escape deve devolver o foco ao imóvel');
  await page.locator('tbody tr').first().locator('td').first().click({ position: { x: 2, y: 2 } });
  await modal().getByRole('heading', { name: 'Detalhamento do ROI', exact: true }).waitFor();
  await close();

  const metricLabels = ['Valor de compra', 'Investimento inicial', 'Aluguel mensal', 'Receita líquida anual', 'Despesas anuais',
    'Fluxo de caixa anual', 'ROI anual', 'Cap Rate', 'Retorno (anos)', 'Retorno (meses)'];
  const metrics = ['purchaseValue', 'totalInvestment', 'monthlyRent', 'netAnnualRevenue', 'totalAnnualExpenses', 'annualCashFlow', 'roi', 'capRate', 'paybackYears', 'paybackMonths'];
  const originLabels = ['Valor de compra', 'Investimento inicial', 'Aluguel mensal médio', 'Receita líquida anual', 'Despesas anuais',
    'Fluxo de caixa anual', 'ROI anual', 'Cap Rate', 'Payback em anos', 'Payback em meses'];
  for (let index = 0; index < metricLabels.length; index++) {
    await valueButton(metricLabels[index]).click();
    await modal().getByRole('heading', { name: 'Origem de ' + originLabels[index], exact: true }).waitFor();
    await modal().getByText('Aluguel recebido março', { exact: true }).waitFor();
    assert.equal(await modal().getByRole('heading', { name: 'Detalhamento do ROI', exact: true }).count(), 0, 'O clique no valor não deve propagar para a linha');
    assert.equal(await page.evaluate(() => window.__originCalls.at(-1).metric), metrics[index]);
    assert.deepEqual(await page.evaluate(() => window.__originCalls.at(-1).propertyIds), ['property-1']);
    await close();
  }

  await valueButton('Aluguel mensal').click();
  for (const text of ['Cadastro do imóvel', 'Banco de teste', 'Centro Casa Centro', '4169/23', '01/01/2020', '05/03/2026', '01/03/2026', '01/08/2026',
    'Fluxo de caixa anual ÷ investimento inicial', 'Aluguéis recebidos ÷ meses de locação']) await modal().getByText(text, { exact: true }).first().waitFor();
  if (process.env.ROI_ORIGIN_DESKTOP_SCREENSHOT) await page.screenshot({ path: resolve(process.env.ROI_ORIGIN_DESKTOP_SCREENSHOT) });
  await modal().getByRole('button', { name: 'Voltar ao detalhamento', exact: true }).click();
  await modal().getByRole('heading', { name: 'Detalhamento do ROI', exact: true }).waitFor();
  await close();

  for (const mode of ['fail', 'throw']) {
    await page.evaluate(mode => window.__originMode = mode, mode);
    await valueButton('Aluguel mensal').click();
    await modal().getByRole('alert').waitFor();
    await page.evaluate(() => window.__originMode = 'success');
    await modal().getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await modal().getByText('Aluguel recebido março', { exact: true }).waitFor();
    await close();
  }

  await page.evaluate(() => window.__originMode = 'defer');
  await valueButton('Aluguel mensal').click();
  await page.waitForFunction(() => window.__pendingOrigins.length === 1);
  await modal().getByRole('status').getByText('Consultando a origem do valor...', { exact: true }).waitFor();
  assert.equal(await modal().getByText('Aluguel recebido março', { exact: true }).count(), 0, 'Uma nova consulta não deve mostrar a origem anterior');
  await close();
  await valueButton('ROI anual').click();
  await page.waitForFunction(() => window.__pendingOrigins.length === 2);
  await page.evaluate(() => window.__pendingOrigins[1].resolve('Resposta atual'));
  await modal().getByText('Resposta atual', { exact: true }).waitFor();
  await page.evaluate(() => window.__pendingOrigins[0].resolve('Resposta antiga'));
  await page.waitForTimeout(50);
  assert.equal(await modal().getByText('Resposta antiga', { exact: true }).count(), 0, 'Uma resposta de modal fechado não deve substituir a consulta atual');
  await close();

  await page.evaluate(() => { window.__reportCount = 2; window.__originMode = 'success'; });
  await page.getByRole('button', { name: 'Recalcular', exact: true }).click();
  await page.locator('tfoot').getByText('Total (2 imóveis)', { exact: true }).waitFor();
  const totals = page.locator('tfoot').getByRole('button');
  assert.ok(await totals.count() >= 9, 'Todos os valores numéricos do rodapé devem permitir consultar a origem');
  for (const button of await totals.all()) {
    await button.click();
    await modal().getByText('Aluguel recebido março', { exact: true }).first().waitFor();
    assert.deepEqual(await page.evaluate(() => window.__originCalls.at(-1).propertyIds), ['property-1', 'property-2']);
    await close();
  }

  await page.locator('tfoot').getByRole('button', { name: 'Ver origem de ROI anual da carteira', exact: true }).click();
  await modal().getByText('Aluguel recebido março', { exact: true }).first().waitFor();
  assert.equal(await modal().locator('details').count(), 2);
  await modal().locator('details').first().getByRole('button', { name: 'Ver origem de Aluguéis recebidos', exact: true }).click();
  await modal().getByRole('heading', { name: 'Origem de Aluguéis realizados', exact: true }).waitFor();
  await modal().getByText('Aluguel recebido março', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__originCalls.at(-1).propertyIds), ['property-1'], 'Um componente dentro do imóvel deve consultar somente a origem desse imóvel');
  assert.equal(await modal().locator('details').count(), 1);
  assert.equal(await modal().getByRole('button', { name: 'Fechar detalhamento do ROI', exact: true }).evaluate(el => el === document.activeElement), true, 'O foco deve permanecer em um controle existente após navegar');
  await modal().getByRole('button', { name: 'Voltar à origem anterior', exact: true }).click();
  await modal().getByRole('heading', { name: 'Origem de ROI anual', exact: true }).waitFor();
  await modal().getByText('Aluguel recebido março', { exact: true }).first().waitFor();
  assert.deepEqual(await page.evaluate(() => window.__originCalls.at(-1).propertyIds), ['property-1', 'property-2'], 'Voltar deve restaurar o escopo da carteira');
  assert.equal(await modal().locator('details').count(), 2);
  await close();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar para Excel', exact: true }).click();
  const exported = await download;
  const workbook = XLSX.read(readFileSync(await exported.path()), { type: 'buffer' });
  const exportRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  assert.equal(exportRows[0].length, 11, 'A exportação deve manter as onze colunas da tabela');
  assert.equal(exportRows[1][0], 'Casa Centro');
  assert.equal(exportRows[2][0], 'Sala Comercial');
  assert.equal(exportRows[3][0], 'Total (2 imóveis)');
  assert.doesNotMatch(JSON.stringify(exportRows), /Ver origem|Ver detalhamento|Aluguel recebido março|Voltar ao detalhamento/, 'Rótulos de interação e conteúdo de modais não devem entrar na planilha');
  assert.deepEqual(await page.evaluate(() => window.__exports.at(-1)), { resource: 'financial-audit', format: 'XLSX', recordCount: 2 });

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar para PDF', exact: true }).click();
  const pdf = await pdfDownload;
  const pdfText = await extractText(new Uint8Array(readFileSync(await pdf.path())), { mergePages: true });
  assert.match(pdfText.text, /Casa Centro/);
  assert.match(pdfText.text, /Sala Comercial/);
  assert.doesNotMatch(pdfText.text, /Ver origem|Ver detalhamento|Aluguel recebido março|Voltar ao detalhamento/, 'Controles e conteúdo de modais não devem entrar no PDF');
  assert.deepEqual(await page.evaluate(() => window.__exports.at(-1)), { resource: 'financial-audit', format: 'PDF', recordCount: 2 });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'A página deve conter o excesso de largura dentro da tabela');
  await detailButton().click();
  await modal().getByRole('heading', { name: 'Detalhamento do ROI', exact: true }).waitFor();
  let size = await modal().evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, rect: { left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right } }));
  assert.ok(size.scrollWidth <= size.width && size.rect.left >= 0 && size.rect.right <= 390, 'O detalhamento deve caber em celular');
  if (process.env.ROI_DETAIL_UI_SCREENSHOT) await page.screenshot({ path: resolve(process.env.ROI_DETAIL_UI_SCREENSHOT) });
  await close();
  await valueButton('Aluguel mensal').click();
  await modal().getByText('Aluguel recebido março', { exact: true }).waitFor();
  size = await modal().evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, rect: { left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right } }));
  assert.ok(size.scrollWidth <= size.width && size.rect.left >= 0 && size.rect.right <= 390, 'A origem deve conter a tabela dentro do modal em celular');
  const closeRect = await modal().getByRole('button', { name: 'Fechar detalhamento do ROI', exact: true }).boundingBox();
  assert.ok(closeRect && closeRect.width >= 24 && closeRect.x >= 0 && closeRect.x + closeRect.width <= 390, 'O botão Fechar deve permanecer visível em celular');
  const closeIcon = await modal().getByRole('button', { name: 'Fechar detalhamento do ROI', exact: true }).locator('svg').boundingBox();
  assert.ok(closeIcon && closeIcon.width >= 16 && closeIcon.x + closeIcon.width <= 390, 'O ícone Fechar deve caber no botão');
  if (process.env.ROI_ORIGIN_MOBILE_SCREENSHOT) await page.screenshot({ path: resolve(process.env.ROI_ORIGIN_MOBILE_SCREENSHOT) });
  await page.keyboard.press('Escape');
  await modal().waitFor({ state: 'detached' });
  assert.equal(await valueButton('Aluguel mensal').evaluate(el => el === document.activeElement), true, 'O foco deve voltar ao valor após fechar a origem');
  assert.deepEqual(errors, [], 'O navegador não deve apresentar erros');
  console.log('ROI aprovado: detalhe em modal por interação, origem de todas as métricas e totais, fontes, falha/retry, corrida, Escape/foco, exportação e celular.');
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  const target = realpathSync(fixture);
  if (dirname(target) !== realpathSync(scratch) || !basename(target).startsWith('roi-detail-ui-')) throw new Error('Diretório de teste fora da área temporária; limpeza cancelada.');
  rmSync(target, { recursive: true, force: true });
}
