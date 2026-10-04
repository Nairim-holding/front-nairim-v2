import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import tailwind from '@tailwindcss/postcss';

const root = process.cwd();
const fixture = path.join(root, '.tmp-e2e/dashboard-regime');
await mkdir(fixture, { recursive: true });
// A página de teste recebe somente datas/valores/tipos, sem dados pessoais do backup.
let rows = [
  { eventDate: '2026-01-01', effectiveDate: '2026-11-01', value: 4700, type: 'EXPENSE' },
  { eventDate: '2025-12-01', effectiveDate: '2026-01-01', value: 300, type: 'EXPENSE' },
  { eventDate: '2026-01-01', effectiveDate: '2026-02-01', value: 120, type: 'EXPENSE' },
  { eventDate: '2026-01-01', effectiveDate: '2026-01-01', value: 1000, type: 'INCOME' },
];
if (process.argv[2]) {
  const backup = JSON.parse((await readFile(process.argv[2], 'utf8')).replace(/^\uFEFF/, '')).data;
  const categories = new Map(backup.categories.map(category => [category.id, category.type]));
  rows = backup.transactions.filter(row => !row.deleted_at && !row.is_transfer).map(row => ({
    eventDate: row.event_date.slice(0, 10), effectiveDate: row.effective_date.slice(0, 10),
    value: Number(row.amount), type: categories.get(row.category_id),
  }));
}
const details = (regime, prefix) => rows.filter(row => row.type === 'EXPENSE' && row[regime === 'competencia' ? 'eventDate' : 'effectiveDate'].startsWith(prefix));
const sum = list => list.reduce((total, row) => total + row.value, 0);
await writeFile(path.join(fixture, 'index.html'), '<html lang="pt-BR"><meta charset="utf-8"><body><div id="root"></div><script type="module" src="./entry.jsx"></script></body></html>');
await writeFile(path.join(fixture, 'entry.jsx'), `
import React,{useMemo,useState} from 'react';import {createRoot} from 'react-dom/client';import * as echarts from 'echarts';
import Header from '@/components/dashboard/FinancialDashboardHeader';import Monthly from '@/components/dashboard/MonthlyIncomeExpenseChart';import '@/app/globals.css';
window.__chart=()=>[...document.querySelectorAll('div[_echarts_instance_]')].map(el=>echarts.getInstanceByDom(el)).find(chart=>chart?.getOption().series?.[0]?.name==='Receitas');
function App(){const [regime,setRegime]=useState('caixa');const [years,setYears]=useState([2026]);const [months,setMonths]=useState([1]);const filters=useMemo(()=>({regime}),[regime]);
return <main style={{padding:16}}><aside style={{padding:12,marginBottom:16,background:'#eff6ff',color:'#1e3a8a',border:'1px solid #93c5fd',borderRadius:8}}><strong>Conferência isolada do backup fornecido</strong><p>Dados do arquivo de produção, com descrições substituídas por nomes de teste. Esta página não usa nem altera o banco do sistema. O gráfico abaixo usa os componentes reais; as consultas são simuladas com as datas e valores do arquivo.</p></aside><Header years={years} selectedMonths={months} onYearsChange={setYears} onMonthsChange={setMonths} regime={regime} onRegimeChange={setRegime} filters={filters}/>
<button onClick={()=>setYears([2025,2026])}>Comparar anos</button><div style={{height:600,display:'flex',flexDirection:'column'}}><Monthly years={years} filters={filters}/></div></main>}
createRoot(document.getElementById('root')).render(<App/>);
`);
const server = await createServer({
  configFile: false, root, resolve: { alias: { '@': path.join(root, 'src') } },
  define: { 'process.env.NEXT_PUBLIC_CARTO_API_KEY': '""', 'process.env.NEXT_PUBLIC_URL_API': '""' },
  css: { postcss: { plugins: [tailwind()] } }, esbuild: { jsx: 'automatic' }, server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'dashboard-regime-fixture', enforce: 'pre', load(id) {
    const f = id.replaceAll('\\', '/');
    if (f.endsWith('/src/contexts/ThemeContext.tsx')) return 'export const useTheme=()=>({theme:"light"});';
    if (f.endsWith('/src/server/actions/financial-transaction.ts')) return `
      const rows=${JSON.stringify(rows)};
      export async function getAvailableYearsAction(){return {ok:true,data:{years:[2031,2030,2029,2028,2027,2026,2025,2024,2023]}}}
      export async function getMonthlySummaryMultiAction(raw){const field=raw.regime==='competencia'?'eventDate':'effectiveDate';window.__summaryQuery=raw;
        return {ok:true,data:raw.years.map(year=>({year,months:Array.from({length:12},(_,i)=>({month:i+1,
          income:rows.filter(row=>row.type==='INCOME'&&row[field].startsWith(year+'-'+String(i+1).padStart(2,'0'))).reduce((s,row)=>s+row.value,0),
          expense:rows.filter(row=>row.type==='EXPENSE'&&row[field].startsWith(year+'-'+String(i+1).padStart(2,'0'))).reduce((s,row)=>s+row.value,0)}))}))};}
      export async function getFinancialChartDetailsAction(query){window.__detailQuery=query;const field=query.regime==='competencia'?'eventDate':'effectiveDate';
        return {ok:true,data:rows.filter(row=>row.type===query.type&&row[field]>=query.startDate&&row[field]<=query.endDate).map((row,i)=>({...row,id:String(i),description:'Lançamento de validação '+(i+1)}))};}
    `;
  } }],
});
let browser;
if (process.argv.includes('--serve')) {
  await server.listen();
  console.log(`Demonstração isolada: ${server.resolvedUrls.local[0]}.tmp-e2e/dashboard-regime/index.html`);
  await new Promise(() => {});
}
try {
  await server.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const url = `${server.resolvedUrls.local[0]}.tmp-e2e/dashboard-regime/index.html`;
  await page.goto(url);
  assert.equal(await page.getByLabel('Regime', { exact: true }).inputValue(), 'caixa');
  async function clickMonth(regime, index, prefix) {
    const expected = sum(details(regime, prefix));
    await page.waitForFunction(({ index, expected }) => window.__chart?.()?.getOption().series[1].data[index] === expected, { index, expected });
    // Aguarda a animação do ECharts antes de clicar na posição do ponto.
    await page.waitForTimeout(1100);
    const position = await page.evaluate(({ index, expected }) => {
      const chart = window.__chart(); const [x, y] = chart.convertToPixel({ seriesIndex: 1 }, [index, expected]);
      const rect = chart.getDom().getBoundingClientRect(); return { x: rect.left + x, y: rect.top + y };
    }, { index, expected });
    await page.mouse.click(position.x, position.y);
    await page.waitForFunction(() => !!window.__detailQuery);
    const query = await page.evaluate(() => window.__detailQuery);
    assert.equal(query.regime, regime); assert.equal(query.startDate, `${prefix}-01`); assert.equal(query.type, 'EXPENSE');
    await page.getByText(`Lançamento de validação 1`, { exact: true }).waitFor();
    const count = details(regime, prefix).length;
    assert.equal(await page.locator('tbody tr').count(), count);
    const currency = expected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    assert.ok((await page.locator('tfoot').innerText()).replaceAll('\u00a0', ' ').includes(currency.replaceAll('\u00a0', ' ')));
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(fixture, `${regime}-${prefix}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Fechar modal', exact: true }).click();
    await page.waitForTimeout(350);
    await page.evaluate(() => { window.__detailQuery = null; });
  }
  await clickMonth('caixa', 0, '2026-01'); await clickMonth('caixa', 1, '2026-02');
  await page.getByLabel('Regime', { exact: true }).selectOption('competencia');
  await clickMonth('competencia', 0, '2026-01');
  await page.getByRole('button', { name: 'Comparar anos' }).click();
  await clickMonth('competencia', 12, '2026-01');
  await page.getByLabel('Regime', { exact: true }).selectOption('caixa');
  await clickMonth('caixa', 12, '2026-01');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(fixture, 'regime-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.reload(); assert.equal(await page.getByLabel('Regime', { exact: true }).inputValue(), 'caixa');
  assert.deepEqual(errors, []);
  console.log('Caixa padrão, seletor de regime, cliques reais de janeiro/fevereiro, comparação entre anos, totais dos detalhes e layout móvel verificados.');
} finally { await browser?.close(); await server.close(); }
