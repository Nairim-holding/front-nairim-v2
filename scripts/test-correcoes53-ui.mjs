import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Componentes reais com actions isoladas: não lê nem altera banco ou serviço real.
const root = process.cwd();
const fixture = mkdtempSync(join(root, '.correcoes53-ui-'));
let server, browser;
try {
  writeFileSync(join(fixture, 'mocks.tsx'), `
    import React from 'react';
    export const MONTH_LABELS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    export const getFinancialChartDetailsAction = async () => ({ok:true,data:[]});
    const item = { id: 'tax', event_date: '2026-10-01', effective_date: '2026-10-10',
      description: 'Imposto de teste', amount: 10993, status: 'COMPLETED', category: { name: 'Impostos' },
      subcategory: { name: 'Tributo de teste' }, financialInstitution: { name: 'Conta de teste' } };
    const line = (key, label, total, sign = -1, kind = 'line') => ({ key, label, total, sign, kind,
      groups: key === 'impostos' ? [{ key: 'tax', label: 'Tributo de teste', total, items: [item] }] : [] });
    export async function getDemonstrativoReportAction(raw) {
      window.__query = raw;
      return { ok: true, data: { groupBy: 'subcategory', unclassifiedExpenseTotal: 0, lines: [
        line('receita_bruta','Receita Bruta',31920.36,1), line('impostos','Impostos',10993),
        line('variaveis','Despesas Variáveis',28397.11), line('fixas','Despesas Fixas',3411.64),
        line('pessoal','Despesas com Pessoal',7670), line('resultado','Resultado',-18551.39,-1,'final') ] } };
    }
    export const getDashboardLayoutAction = async () => ({ ok: true, data: { layout: JSON.parse(localStorage.getItem('layout') || '[]') } });
    export const saveDashboardLayoutAction = async ({layout}) => { localStorage.setItem('layout',JSON.stringify(layout)); return {ok:true}; };
    const showMessage = () => {};
    export const useMessageContext = () => ({ showMessage });
    export default function Link(props) { return <a {...props}/>; }
  `);
  writeFileSync(join(fixture, 'main.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import Grid from '@/components/dashboard/DashboardWidgetGrid';
    import Dfc from '@/components/dashboard/FinancialDashboardGrid/DashboardDemonstrativoWidget';
    import Taxes from '@/components/dashboard/FinancialDashboardGrid/TaxesWidget';
    const props = { year: 2026, startDate: '2026-10-01', endDate: '2026-10-31', filters: { regime: 'caixa' } };
    const layout = [{i:'tax',x:0,y:0,w:12,h:3},{i:'dfc',x:0,y:3,w:12,h:12}];
    createRoot(document.getElementById('root')).render(<Grid resource="correcoes53" defaultLayout={layout}
      renderWidget={id => ({framed:true, body:id==='dfc'?<Dfc {...props}/>:<Taxes {...props}/>})}/>);
  `);
  const css = readdirSync(join(root, '.next/static/css')).filter(n => n.endsWith('.css'))
    .map(n => readFileSync(join(root, '.next/static/css', n), 'utf8')).join('\n');
  writeFileSync(join(fixture, 'style.css'), css);
  writeFileSync(join(fixture, 'index.html'), '<html lang="pt-BR"><head><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  const mocked = ['next/link', '@/contexts', '@/server/actions/financial-report', '@/server/actions/user-preferences',
    '@/server/actions/financial-transaction', '@/components/dashboard/MonthlyIncomeExpenseChart'];
  server = await createServer({ configFile:false, root:fixture, esbuild:{jsx:'automatic'}, define:{'process.env.DRAGGABLE_DEBUG':'false'},
    resolve:{alias:[...mocked.map(find=>({find:new RegExp('^'+find+'$'),replacement:join(fixture,'mocks.tsx')})),{find:'@',replacement:join(root,'src')}]},
    server:{host:'127.0.0.1',port:0,fs:{allow:[root]}} });
  await server.listen();
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
  await page.getByText('158,12%',{exact:true}).waitFor();
  for (const pct of ['34,44%','88,96%','10,69%','24,03%']) await page.getByText(pct,{exact:true}).waitFor();
  const dfc = page.locator('.react-grid-item').filter({has:page.getByRole('heading',{name:/Demonstrativo Financeiro/})});
  await dfc.locator('tbody').getByTitle('Expandir',{exact:true}).first().click();
  await dfc.getByTitle('Ver lançamentos',{exact:true}).click();
  const headers=['','Competência','Data efetiva','Descrição','Valor','Tipo','Categoria','Subcategoria','Conta','Cartão','Contato','Centro','Status'];
  assert.deepEqual(await dfc.locator('tr').filter({hasText:'Competência'}).locator('th').allTextContents(),headers);
  for(const tr of await dfc.locator('tr').all()) {
    assert.equal(await tr.locator('th,td').evaluateAll(cells=>cells.reduce((n,c)=>n+c.colSpan,0)),13);
  }
  // Arrastar pela barra do título deve salvar e restaurar a nova posição.
  const handle = dfc.locator('.widget-drag-handle');
  const box=await handle.boundingBox();
  await page.mouse.move(box.x+120,box.y+18); await page.mouse.down();
  await page.mouse.move(box.x+120,18,{steps:12}); await page.mouse.up();
  await page.waitForFunction(()=>{const row=JSON.parse(localStorage.getItem('layout')||'[]').find(x=>x.i==='dfc');return row && row.y!==3;});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('layout')).find(x=>x.i==='dfc').y);
  assert.notEqual(saved,3);
  await page.reload(); await page.getByText('158,12%',{exact:true}).waitFor();
  assert.equal(await dfc.getAttribute('style').then(s=>s.includes('translate')),true);
  await dfc.getByLabel('Expandir',{exact:true}).click();
  await page.getByRole('heading',{level:2,name:/Demonstrativo Financeiro/}).waitFor();
  await page.getByTitle('Fechar',{exact:true}).click();
  assert.equal(await page.getByRole('heading',{level:2,name:/Demonstrativo Financeiro/}).count(),0);
  const tax = page.locator('.react-grid-item').filter({hasText:'Total de Impostos e Taxas'});
  await tax.getByText(/10\.993/).first().click();
  await page.getByText('Imposto de teste',{exact:true}).waitFor();
  assert.deepEqual(await page.locator('table').last().locator('thead th').allTextContents(), headers.slice(1));
  assert.deepEqual(errors,[]);
  console.log('Correções 53 aprovadas: percentuais, 13 colunas, impostos, arraste persistido e tela cheia.');
} finally {
  await browser?.close(); await server?.close(); rmSync(fixture,{recursive:true,force:true});
}
