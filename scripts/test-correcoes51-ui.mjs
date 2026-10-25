import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import assert from 'node:assert/strict';
const root = realpathSync(process.cwd()), scratch = join(root, '.tmp-e2e');
mkdirSync(scratch, {recursive:true});
const fixture = mkdtempSync(join(scratch, 'correcoes51-ui-'));
let server, browser;
try {
  writeFileSync(join(fixture,'mocks.tsx'), `
    import React,{useEffect,useState} from 'react';
    import {buildCreditCardDashboard} from '@/core/entities/credit-card-dashboard';
    export {getThemeTokens} from '@/utils/getThemeTokens';
    export const formatCurrency=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    export function Section({title,children}){return <main className="min-h-screen bg-page p-3"><h1>{title}</h1>{children}</main>};export default Section;
    export const usePermissions=()=>({can:(_resource,action)=>!window.__readonly||action==='view'});
    const showMessage=()=>{};const showPopup=(_title,_message,yes)=>yes();
    export const useMessageContext=()=>({showMessage});
    export const usePopupContext=()=>({showPopup});
    export const useTheme=()=>{const [dark,setDark]=useState(false);useEffect(()=>{const fn=()=>setDark(document.body.classList.contains('dark'));window.addEventListener('theme',fn);return()=>window.removeEventListener('theme',fn)},[]);return {isDark:dark}};
    const cards=[{id:'a',name:'Cartão A',limit:1000,closingDay:1,dueDay:10,active:true},{id:'b',name:'Cartão B',limit:500,closingDay:5,dueDay:15,active:true}];
    export async function getCreditCardDashboardAction(input){
      window.__calls??=[];window.__calls.push(input);
      if(window.__failure){window.__failure=false;return {ok:false,error:'Falha de teste'}};
      const entries=cards.map((card,index)=>({id:'tx'+index,cardId:card.id,cardName:card.name,date:'2026-01-05',effectiveDate:'2026-01-10',description:'Compra '+card.name,amount:100*(index+1),status:'PENDING',year:2026,month:1,categoryId:'c'+index,categoryName:index?'Serviços':'Mercado',subcategory:null,installment:null}));
      return {ok:true,data:buildCreditCardDashboard(cards,entries,input.year,input.month,input.cardIds)};
    }
    export async function listCardsAction(){return {ok:true,data:{data:cards.map(c=>({...c,is_active:true,closing_day:1,due_day:10})),totalPages:1}}};
    export async function getCardByIdAction(id){return {ok:true,data:{id,name:'Cartão '+id.toUpperCase(),limit:1000,closing_day:1,due_day:10}}};
    export async function createFinancialCardAction(input){window.__create=input;return {ok:true,data:{id:'new',...input}}};
    export async function updateFinancialCardAction(id,input){window.__update={id,input};return {ok:true,data:{id,...input}}};
    export async function deleteFinancialCardAction(id){window.__delete=id;return {ok:true,data:null}};
    export async function getExtratoReportAction(){return {ok:true,data:{items:[{id:'1',event_date:'2026-01-01',effective_date:'2026-01-10',description:'Baixa B',credit:100,debit:0,balance:100},{id:'2',event_date:'2026-01-02',effective_date:'2026-01-10',description:'Baixa A',credit:0,debit:30,balance:70}],summary:{saldoAnterior:0,totalReceitas:100,totalDespesas:30,balancoPeriodo:70,saldoFinal:70}}}};
    export const useMonthlySummaryMulti=()=>({isLoading:false,byYear:{2026:Array.from({length:12},(_,i)=>({month:i+1,income:100,expense:30}))}});
    export async function getFinancialChartDetailsAction(){return {ok:true,data:[]}};
    export async function getCenterSummaryAction(){return {ok:true,data:Array.from({length:16},(_,i)=>({id:''+i,name:'Centro '+i,income:100,expense:30,balance:70,centerIds:[''+i]}))}};
  `);
  // The shared form engine is independently covered; this fixture checks that maintenance invokes its existing actions.
  writeFileSync(join(fixture,'form.tsx'), `import React from 'react';export default function Form({mode,id,onSubmit,onSuccess}){return <div><p>{mode==='create'?'Criar cartão':'Editar cartão '+id}</p><button onClick={async()=>{await onSubmit({name:'Teste',limit:'1.000,00',closing_day:1,due_day:10,is_active:true});onSuccess?.()}}>Salvar teste</button></div>}`);
  writeFileSync(join(fixture,'main.tsx'), `
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';import * as echarts from 'echarts';
    import Cards from '@/app/dashboard/(financeiro)/cartoes/page';import Extrato from '@/app/dashboard/(financeiro)/relatorios/_components/ExtratoView';
    import Monthly from '@/components/dashboard/MonthlyIncomeExpenseChart';import Centers from '@/components/dashboard/CenterIncomeExpenseChart';
    import {EMPTY_FILTERS} from '@/app/dashboard/(financeiro)/relatorios/_lib/types';
    window.__charts=()=>[...document.querySelectorAll('div[_echarts_instance_]')].map(el=>echarts.getInstanceByDom(el)).filter(Boolean);
    function App(){const[view,setView]=useState('cards');return <><nav>{['cards','statement','monthly','centers'].map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}<button onClick={()=>{document.body.classList.toggle('dark');window.dispatchEvent(new Event('theme'))}}>Tema</button></nav>{view==='cards'?<Cards/>:view==='statement'?<Extrato dateRange={{from:'2026-01-01',to:'2026-01-31'}} regime="competencia" filters={EMPTY_FILTERS}/>:<div style={{height:650,display:'flex',flexDirection:'column'}}>{view==='monthly'?<Monthly year={2026}/>:<Centers startDate="2026-01-01" endDate="2026-12-31" year={2026} years={[2026]}/>}</div>}</>};createRoot(document.getElementById('root')).render(<App/>);
  `);
  const css = await postcss([tailwindcss()]).process(readFileSync(join(root,'src/app/globals.css'),'utf8'),{from:join(root,'src/app/globals.css')});
  writeFileSync(join(fixture,'style.css'),css.css);
  writeFileSync(join(fixture,'index.html'),'<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  const modules=['@/components/layout/PageSection','@/contexts/ThemeContext','@/contexts/PermissionsContext','@/contexts/MessageContext','@/contexts/PopupContext','@/server/actions/credit-card-dashboard','@/server/actions/financial-card','@/server/actions/financial-report','@/server/actions/financial-transaction','@/server/actions/center-summary','@/hooks/useMonthlySummaryMulti'];
  server=await createServer({configFile:false,root:fixture,cacheDir:join(fixture,'vite-cache'),esbuild:{jsx:'automatic'},resolve:{alias:[{find:'@/components/form/DynamicForm',replacement:join(fixture,'form.tsx')},...modules.map(find=>({find,replacement:join(fixture,'mocks.tsx')})),{find:/^@\/utils$/,replacement:join(fixture,'mocks.tsx')},{find:'@',replacement:join(root,'src')}]},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
  await page.getByLabel('Ano das faturas').fill('2026');await page.getByLabel('Mês da fatura').selectOption('1');
  const rows=page.locator('tbody tr');await page.getByText('Compra Cartão A',{exact:true}).waitFor();assert.equal(await rows.count(),2);
  await page.getByRole('button',{name:'Selecionar cartão Cartão B',exact:true}).click();await page.waitForFunction(()=>window.__calls.at(-1).cardIds?.length===1);await page.getByText('Compra Cartão B',{exact:true}).waitFor({state:'detached'});assert.equal(await rows.count(),1);
  await page.getByRole('button',{name:'Limpar seleção',exact:true}).click();await page.getByText('Sem lançamentos para a seleção e fatura informadas.').waitFor();assert.equal(await rows.count(),0);
  await page.getByRole('button',{name:'Selecionar todos',exact:true}).click();await page.getByText('Compra Cartão B',{exact:true}).waitFor();assert.equal(await rows.count(),2);
  await page.getByLabel('Mês da fatura').selectOption('2');await page.getByText('Sem lançamentos para a seleção e fatura informadas.').waitFor();await page.getByLabel('Mês da fatura').selectOption('1');await page.getByText('Compra Cartão A',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Novo cartão',exact:true}).click();const modal=page.getByRole('dialog',{name:'Gerenciar cartões',exact:true});await modal.getByText('Criar cartão',{exact:true}).waitFor();await modal.getByRole('button',{name:'Salvar teste'}).click();await page.waitForFunction(()=>window.__create?.name==='Teste');await page.keyboard.press('Escape');await modal.waitFor({state:'detached'});
  await page.getByRole('button',{name:'Editar Cartão A',exact:true}).click();await modal.getByText('Editar cartão a',{exact:true}).waitFor();await modal.getByRole('button',{name:'Salvar teste'}).click();await page.waitForFunction(()=>window.__update?.id==='a');await page.keyboard.press('Escape');await modal.waitFor({state:'detached'});
  await page.evaluate(()=>window.__failure=true);await page.getByRole('button',{name:'Próximo ano'}).click();await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Tentar novamente'}).click();await page.getByRole('button',{name:'Selecionar cartão Cartão A'}).waitFor();await page.getByRole('button',{name:'Ano anterior'}).click();await page.getByText('Compra Cartão A',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Tema',exact:true}).click();await page.waitForFunction(()=>window.__charts().length===2);const darkTooltip=await page.evaluate(()=>window.__charts()[1].getOption().tooltip[0].formatter({name:'<img src=x>',value:100}));assert.match(darkTooltip,/#12101d/);assert.match(darkTooltip,/&lt;img/);
  if(process.env.CORRECOES51_UI_SCREENSHOT)await page.screenshot({path:resolve(process.env.CORRECOES51_UI_SCREENSHOT),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);await page.getByRole('button',{name:'Gerenciar cartões',exact:true}).click();await modal.waitFor();const bounds=await modal.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'statement',exact:true}).click();await page.getByRole('checkbox',{name:'Formato bancário'}).check();assert.equal(await page.locator('thead th').count(),5);assert.deepEqual(await page.locator('tbody tr').allTextContents().then(rows=>rows.slice(1).map(text=>text.includes('Baixa B')?'B':'A')),['B','A']);assert.match(await page.locator('tbody').innerText(),/01\/01\/2026/);assert.equal(await page.locator('tfoot td').first().getAttribute('colspan'),'2');await page.getByRole('columnheader',{name:'Descrição',exact:true}).click();assert.match(await rows.nth(1).innerText(),/Baixa B/);
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'monthly',exact:true}).click();await page.waitForFunction(()=>window.__charts().length===1);const monthly=await page.evaluate(()=>window.__charts()[0].getOption().tooltip[0].formatter([{dataIndex:0,seriesName:'Receitas',value:100}]));assert.match(monthly,/Saldo/);assert.match(monthly,/70,00/);assert.equal(monthly.split('background-color: #1f2937').length-1,2);
  await page.getByRole('button',{name:'centers',exact:true}).click();await page.waitForFunction(()=>window.__charts()[0]?.getOption().dataZoom?.length);const zoom=await page.evaluate(()=>window.__charts()[0].getOption().dataZoom[0]);assert.equal(zoom.showDataShadow,false);assert.equal(zoom.width,12);
  assert.deepEqual(errors,[]);console.log('Documento 51: cartões com seleção múltipla, vazio, período, erro/repetição, manutenção criar/editar e celular; extrato bancário/competência/ordem/total; saldo mensal e tooltip escuro seguro; zoom de centros sem sombra.');
} finally { if(browser)await browser.close();if(server)await server.close();const target=realpathSync(fixture);if(dirname(target)!==scratch||!basename(target).startsWith('correcoes51-ui-'))throw new Error('Pasta temporária fora do workspace');rmSync(target,{recursive:true,force:true}); }
