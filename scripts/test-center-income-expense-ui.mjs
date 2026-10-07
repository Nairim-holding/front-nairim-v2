import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root = realpathSync(process.cwd());
const fixture = mkdtempSync(join(root, '.center-chart-ui-'));
let server; let browser;
try {
  writeFileSync(join(fixture, 'mocks.tsx'), `
    import { buildCenterSummary } from '@/core/entities/center-summary';
    export { getThemeTokens } from '@/utils/getThemeTokens';
    export const formatCurrency = value => Number(value).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
    export const useTheme = () => ({ theme: 'light' });
    export async function getCenterSummaryAction(input) {
      const many = input.startDate === '2026-02-01';
      const names = many ? Array.from({length: 16}, (_, index) => 'Imóvel ' + (index+1)) : ['Avenida Dr. Rafael Paes de Barros, 100', 'Rua América, 389', 'Rua Alemanha, 280'];
      const centers = names.flatMap((name, index) => [{id:'cr-'+index,name:name+' (CR)',company_id:'a',type:'INCOME'},{id:'db-'+index,name:name+' (DB)',company_id:'a',type:'EXPENSE'}]);
      const properties = names.map((title,index) => ({id:'property-'+index,title,company_id:'a',center_id:'cr-'+index,debit_center_id:'db-'+index}));
      const totals = names.flatMap((name,index) => [{center_id:'cr-'+index,category_id:'in',amount:23000/(index+1)},{center_id:'db-'+index,category_id:'out',amount:!many&&index===2?10000:3300/(index+1)}]);
      if(!many)totals.push({center_id:null,category_id:'in',amount:100},{center_id:null,category_id:'out',amount:200});
      const rows = buildCenterSummary(totals,centers,[{id:'in',type:'INCOME'},{id:'out',type:'EXPENSE'}],properties);
      window.__rows=rows; window.__detailCalls=[]; return {ok:true,data:rows};
    }
    export async function getFinancialChartDetailsAction(query,filters){
      window.__detailCalls.push({query,filters});
      if(window.__detailFailure){window.__detailFailure=false;return {ok:false,error:'Falha de teste ao carregar lançamentos'};}
      const row=window.__rows.find(row=>JSON.stringify(row.centerIds)===JSON.stringify(query.centerIds));
      const types=query.type?[query.type]:['INCOME','EXPENSE'];
      return {ok:true,data:types.map(type=>({id:type,eventDate:'2026-01-01',effectiveDate:'2026-01-10',description:type==='INCOME'?'Aluguel detalhado':'Reparo detalhado',value:type==='INCOME'?row.income:(query.net?-row.expense:row.expense),type:type==='INCOME'?'Receita':'Despesa',category:type==='INCOME'?'Aluguel':'Manutenção',subcategory:'Predial',institution:'Conta principal',card:'Cartão teste',supplier:'Prestador teste',center:row.name,status:'COMPLETED'}))};
    }
  `);
  writeFileSync(join(fixture, 'main.tsx'), `
    import React,{useState} from 'react'; import {createRoot} from 'react-dom/client'; import * as echarts from 'echarts';
    import Chart from '@/components/dashboard/CenterIncomeExpenseChart';
    window.__chart=()=>[...document.querySelectorAll('div[_echarts_instance_]')].map(el=>echarts.getInstanceByDom(el)).filter(Boolean).at(-1);
    function App(){const [many,setMany]=useState(false);return <main style={{padding:16}}><button onClick={()=>setMany(!many)}>Alternar quantidade</button><div style={{height:640,display:'flex',flexDirection:'column',border:'1px solid #ddd',borderRadius:12,background:'white'}}><Chart startDate={many?'2026-02-01':'2026-01-01'} endDate='2026-12-31' year={2026} years={[2026]} filters={{supplier_id:['supplier'],regime:'competencia',status:'COMPLETED'}}/></div></main>}
    createRoot(document.getElementById('root')).render(<App/>);
  `);
  const cssDirectory=join(root,'.next','static','css');
  writeFileSync(join(fixture,'style.css'),readdirSync(cssDirectory).filter(name=>name.endsWith('.css')).map(name=>readFileSync(join(cssDirectory,name),'utf8')).join('\n'));
  writeFileSync(join(fixture,'index.html'),'<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  server=await createServer({configFile:false,root:fixture,esbuild:{jsx:'automatic'},resolve:{alias:[
    ...['@/contexts/ThemeContext','@/server/actions/center-summary','@/server/actions/financial-transaction','@/components/dashboard/MonthlyIncomeExpenseChart'].map(find=>({find,replacement:join(fixture,'mocks.tsx')})),{find:/^@\/utils$/,replacement:join(fixture,'mocks.tsx')},{find:'@',replacement:join(root,'src')}]},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
  await server.listen(); browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
  await page.waitForFunction(()=>window.__chart?.()?.getOption().series?.[0]?.data.length===4);
  const verifyPairGeometry=async()=>{
    const geometry=await page.evaluate(()=>{
      const chart=window.__chart();const option=chart.getOption();
      const income=chart.getModel().getSeriesByIndex(0).getData().getItemLayout(0);
      const expense=chart.getModel().getSeriesByIndex(1).getData().getItemLayout(0);
      const balance=chart.getModel().getSeriesByIndex(2).getData().getItemLayout(0);
      const next=chart.getModel().getSeriesByIndex(0).getData().getItemLayout(1);
      const lines=chart.getZr().storage.getDisplayList().filter(el=>el.type==='line'&&el.shape.y1===el.shape.y2&&String(el.style.stroke).toLowerCase()===String(option.yAxis[0].splitLine.lineStyle.color).toLowerCase()).map(el=>({y:el.shape.y1,x1:el.shape.x1,x2:el.shape.x2}));
      return {names:option.yAxis[0].data,income,expense,balance,next,lines,split:option.yAxis[0].splitLine};
    });
    assert.equal(geometry.income.x,geometry.expense.x,'Receita e despesa devem começar no mesmo eixo');
    assert.ok(geometry.expense.y>geometry.income.y,'As duas barras do imóvel devem ser adjacentes');
    assert.ok(geometry.balance.y>geometry.expense.y,'O saldo deve ser a terceira barra do imóvel');
    assert.ok(geometry.balance.y+geometry.balance.height<geometry.next.y,'O próximo imóvel deve iniciar após o par de barras');
    assert.ok(geometry.lines.some(line=>line.y>geometry.balance.y+geometry.balance.height&&line.y<geometry.next.y),'Uma linha cinza deve separar os blocos de imóveis');
    assert.ok(geometry.names.every(name=>!name.endsWith('(CR)')&&!name.endsWith('(DB)')));
    return geometry;
  };
  if(process.env.CENTER_CHART_UI_SCREENSHOT)await page.screenshot({path:resolve(process.env.CENTER_CHART_UI_SCREENSHOT)});
  await verifyPairGeometry();
  assert.deepEqual(await page.evaluate(()=>window.__chart().getOption().series.map(series=>series.data[0])),[23000,3300,19700]);
  await page.getByRole('button',{name:'Ver Dados Detalhados',exact:true}).click();
  await page.getByRole('columnheader',{name:'Receitas',exact:true}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),4);
  assert.match(await page.locator('tbody tr').first().innerText(),/23.000,00/);
  assert.match(await page.locator('tbody tr').first().innerText(),/3.300,00/);
  await page.getByRole('button',{name:'Fechar modal',exact:true}).click();
  await page.getByRole('button',{name:'Fechar modal',exact:true}).waitFor({state:'detached'});
  const clickBar=async(seriesIndex,localIndex=0,expectError=false)=>{
    const coordinates=await page.evaluate(({seriesIndex,localIndex})=>{
      const chart=window.__chart(),layout=chart.getModel().getSeriesByIndex(seriesIndex).getData().getItemLayout(localIndex),rect=chart.getDom().getBoundingClientRect();
      return {x:rect.left+layout.x+layout.width/2,y:rect.top+layout.y+layout.height/2};
    },{seriesIndex,localIndex});
    await page.mouse.click(coordinates.x,coordinates.y);
    if(expectError)await page.getByRole('alert').waitFor();
    else await page.getByRole('columnheader',{name:'Descrição',exact:true}).waitFor();
    await page.waitForFunction(()=>!document.body.innerText.includes('Carregando'));
  };
  assert.equal(await page.evaluate(()=>window.__chart().getOption().series[2].itemStyle.color),'#86efac');
  const negative=await page.evaluate(()=>{const chart=window.__chart();const index=chart.getOption().series[2].data.findIndex(value=>value<0);const layout=chart.getModel().getSeriesByIndex(2).getData().getItemLayout(index);return {value:chart.getOption().series[2].data[index],width:layout.width};});
  assert.ok(negative.value<0&&negative.width<0,'Saldo negativo precisa manter o sinal e a direção da barra');
  for(const [series,type,total] of [[0,'INCOME','23.000,00'],[1,'EXPENSE','3.300,00'],[2,undefined,'19.700,00']]){
    await clickBar(series);
    assert.deepEqual(await page.evaluate(()=>window.__detailCalls.at(-1).query.centerIds),['cr-0','db-0']);
    assert.equal(await page.evaluate(()=>window.__detailCalls.at(-1).query.type),type);
    assert.equal(await page.evaluate(()=>window.__detailCalls.at(-1).query.net),series===2);
    assert.equal(await page.locator('tbody tr').count(),series===2?2:1);
    const text=await page.locator('tbody').innerText();
    for(const field of ['Predial','Conta principal','Cartão teste','Prestador teste','Concluído'])assert.ok(text.includes(field),field);
    assert.match(await page.locator('tfoot').innerText(),new RegExp(total.replace('.','\\.')));
    await page.getByRole('button',{name:'Fechar modal',exact:true}).click();
  await page.getByRole('button',{name:'Fechar modal',exact:true}).waitFor({state:'detached'});
  }
  await clickBar(2,3);
  assert.deepEqual(await page.evaluate(()=>window.__detailCalls.at(-1).query.centerIds),[null]);
  assert.match(await page.locator('tfoot').innerText(),/-.*100,00/);
  await page.getByRole('button',{name:'Fechar modal',exact:true}).click();
  await page.getByRole('button',{name:'Fechar modal',exact:true}).waitFor({state:'detached'});
  await page.evaluate(()=>window.__detailFailure=true);
  await clickBar(0,0,true);
  assert.ok((await page.locator('body').innerText()).includes('Falha de teste ao carregar lançamentos'));
  await page.getByRole('button',{name:'Fechar modal',exact:true}).click();
  await page.getByRole('button',{name:'Fechar modal',exact:true}).waitFor({state:'detached'});
  await page.getByRole('button',{name:'Expandir',exact:true}).click();
  await page.getByRole('button',{name:'Fechar',exact:true}).waitFor();
  await verifyPairGeometry();
  await clickBar(2);
  assert.equal(await page.locator('tbody tr').count(),2);
  await page.getByRole('button',{name:'Fechar modal',exact:true}).click();
  await page.getByRole('button',{name:'Fechar modal',exact:true}).waitFor({state:'detached'});
  if(process.env.CENTER_CHART_UI_SCREENSHOT)await page.screenshot({path:resolve(process.env.CENTER_CHART_UI_SCREENSHOT)});
  await page.getByRole('button',{name:'Alternar quantidade'}).click();
  await page.waitForFunction(()=>window.__chart?.()?.getOption().series?.[0]?.data.length===16);
  assert.equal(await page.evaluate(()=>window.__chart().getOption().dataZoom[0].end),75);
  await page.evaluate(()=>window.__chart().dispatchAction({type:'dataZoom',start:25,end:100}));
  await verifyPairGeometry();
  await clickBar(2);
  assert.deepEqual(await page.evaluate(()=>window.__detailCalls.at(-1).query.centerIds),['cr-4','db-4']);
  assert.deepEqual(await page.evaluate(()=>window.__detailCalls.at(-1).filters),{supplier_id:['supplier'],regime:'competencia',status:'COMPLETED'});
  await page.getByRole('button',{name:'Fechar modal',exact:true}).click();
  await page.getByRole('button',{name:'Fechar modal',exact:true}).waitFor({state:'detached'});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.documentElement.scrollWidth<=window.innerWidth);
  assert.deepEqual(errors,[]);
  console.log('UI aprovada: receita/despesa/saldo por imóvel, valores negativos, clique em barras com lançamentos completos, filtros, Sem centro, divisória cinza entre blocos, totais no detalhe, tela cheia, rolagem e celular.');
} finally {
  if(browser)await browser.close();if(server)await server.close();
  const target=realpathSync(fixture);
  if(dirname(target)!==root||!basename(target).startsWith('.center-chart-ui-'))throw new Error('Diretório de teste fora do projeto.');
  rmSync(target,{recursive:true,force:true});
}
