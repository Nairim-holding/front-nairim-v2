import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import tailwind from '@tailwindcss/postcss';
import assert from 'node:assert/strict';

const root = process.cwd();
const fixture = path.join(root, '.tmp-e2e/correcoes44');
await mkdir(fixture, { recursive: true });
const item = { id: 'tx', description: 'Manutenção hidráulica — José Gonçalves', amount: 200, event_date: '2026-10-02', effective_date: '2026-10-02', status: 'COMPLETED',
  category: { id: 'cat', name: 'Reparação' }, subcategory: null, financialInstitution: { id: 'bank', name: 'Conta' }, card: null, supplier: { id: 'p', name: 'Fábio' }, center: { id: 'c', name: 'Imóvel São José' } };
const summary = { saldoAnterior: 0, totalReceitas: 1000, totalDespesas: 17399.02, balancoPeriodo: -16399.02, saldoFinal: -16399.02 };
const extrato = { items: Array.from({ length: 140 }, (_,i) => ({ ...item, id: `tx-${i}`, credit: i === 0 ? 1000 : 0, debit: i ? 200 : 0, balance: i === 0 ? 1000 : -200*i })), summary };
const income = { receitas: { groups: [{ categoryId: 'in', category: 'Receitas', total: 1000, count: 1, items: [{ ...item,id: 'in' }] }], total: 1000 },
  despesas: { groups: [{ categoryId:'out',category: 'Despesas Fixas', total: 17399.02, count:140, items: extrato.items }], total:17399.02 }, summary };
const dfc = { lines: [ {key:'receita_bruta',label:'Receita Bruta',kind:'line',sign:1,total:1000,groups:[{key:'g',label:'02/10/2026',total:1000,count:1,items:[item]}]},
  {key:'resultado_bruto',label:'Resultado Bruto',kind:'subtotal',sign:-1,total:-200,groups:[]},
  {key:'lucro_operacional_bruto',label:'Lucro Operacional Bruto',kind:'subtotal',sign:1,total:200,groups:[]},
  {key:'resultado',label:'Resultado',kind:'final',sign:-1,total:-16399.02,groups:[]} ], unclassifiedExpenseTotal: 0 };
const repair = { id:'00000000-0000-4000-8000-000000000010',property_id:'00000000-0000-4000-8000-000000000001',property:{id:'00000000-0000-4000-8000-000000000001',title:'Imóvel São José'},
  supplier_id:'00000000-0000-4000-8000-000000000050',supplier:{id:'00000000-0000-4000-8000-000000000050',legal_name:'José Gonçalves',trade_name:null},
  event_date:'2026-10-02',event_type:'REPAIR',problem_type:'HYDRAULIC',description:'Infiltração na cozinha',professional:'José Gonçalves',service_amount:1200,materials_amount:300,payment_method:'Pix',payment_conditions:'À vista',
  status:'PLANNED',start_date:null,completion_date:null,notes:null,media:[] };
await writeFile(path.join(fixture,'index.html'), '<html lang="pt-BR"><meta charset="utf-8"><body><div id="root"></div><script type="module" src="./entry.jsx"></script></body></html>');
await writeFile(path.join(fixture,'entry.jsx'), `
import React, {useEffect, useRef, useState} from 'react'; import {createRoot} from 'react-dom/client';
import Repairs from '@/app/dashboard/reparos/content';
import Extrato from '@/app/dashboard/(financeiro)/relatorios/_components/ExtratoView';
import Income from '@/app/dashboard/(financeiro)/relatorios/_components/IncomeExpenseView';
import Dfc from '@/app/dashboard/(financeiro)/relatorios/_components/DemonstrativoView';
import Center from '@/components/dashboard/CenterIncomeExpenseChart';
import {EMPTY_FILTERS} from '@/app/dashboard/(financeiro)/relatorios/_lib/types';
import {printReportElement,exportTableToPDF} from '@/lib/reports/exportHelpers'; import '@/app/globals.css';
const dateRange={from:'2026-10-01',to:'2026-10-31'};
const context={reportTitle:'Relatório de manutenção',dateRange,filterLabels:[],userName:'Fábio Rodrigues Gonçalves'};
function App(){ const ref=useRef(null); const [kind,setKind]=useState('sintetico'); const view=new URLSearchParams(location.search).get('view');
const [message,setMessage]=useState('');useEffect(()=>{const listener=event=>setMessage(event.detail);window.addEventListener('fixture-message',listener);return()=>window.removeEventListener('fixture-message',listener)},[]);
const props={ref,dateRange,regime:'caixa',filters:EMPTY_FILTERS,reportKind:kind};
return view==='repairs'?<><p style={{padding:12,background:'#eff6ff',color:'#1e3a8a'}}>Demonstração de Reparos com dados fictícios. Os cadastros ficam apenas na memória desta página.</p>{message&&<p role="status" style={{padding:12}}>{message}</p>}<Repairs/></>:view==='center'?<div style={{height:600,position:'relative',display:'flex',flexDirection:'column'}}><Center year={2026} years={[2026]} startDate="2026-10-01" endDate="2026-10-31"/></div>:<>
<button onClick={()=>setKind(kind==='analitico'?'sintetico':'analitico')}>Alternar Analítico</button>
<button onClick={()=>printReportElement(ref.current.getTableElement(),context,ref.current.getSummaryElement?.())}>Imprimir teste</button>
<button onClick={()=>exportTableToPDF(ref.current.getTableElement(),'correcoes44',context,ref.current.getSummaryElement?.())}>Exportar teste</button>
{view==='extrato'?<Extrato {...props}/>:view==='income'?<Income {...props}/>:<Dfc key={kind} {...props}/>}</>}
createRoot(document.getElementById('root')).render(<App/>);
`);
const server = await createServer({ configFile:false, root, define:{'process.env.NEXT_PUBLIC_CARTO_API_KEY':'""','process.env.NEXT_PUBLIC_URL_API':'""'}, resolve:{alias:{'@':path.join(root,'src')}}, css:{postcss:{plugins:[tailwind()]}}, esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:0},
  plugins:[{name:'correcoes44-fixtures',enforce:'pre',resolveId(id){if(id==='next/link') return '\0fixture-link';},load(id){
    if(id==='\0fixture-link') return 'import {createElement} from "react";export default function Link({href,children,...props}){return createElement("a",{href,...props},children)}';
    const f=id.replaceAll('\\','/');
    if(f.endsWith('/src/contexts/ThemeContext.tsx')) return 'export const useTheme=()=>({theme:"light"});';
    if(f.endsWith('/src/contexts/PermissionsContext.tsx')) return 'export const usePermissions=()=>({can:()=>true});';
    if(f.endsWith('/src/contexts/MessageContext.tsx')) return 'const showMessage=(message)=>{window.__lastMessage=message;window.dispatchEvent(new CustomEvent("fixture-message",{detail:message}))};export const useMessageContext=()=>({showMessage});';
    if(f.endsWith('/src/contexts/PopupContext.tsx')) return 'const showPopup=(title,content,onConfirm)=>{if(window.confirm(title+"\\n"+content))onConfirm?.()};export const usePopupContext=()=>({showPopup});';
    if(f.endsWith('/src/server/actions/company.ts')) return 'export async function getMyBrandingAction(){return {ok:true,data:{company_name:"Imobiliária São José",trade_name:"Imobiliária São José",legal_name:"Administração & Gestão",cnpj:"12.345.678/0001-00",logo_url:null}}}';
    if(f.endsWith('/src/server/actions/financial-supplier.ts')) return `const contacts=[${JSON.stringify(repair.supplier)}];
      export async function listSuppliersAction(){return {ok:true,data:{data:contacts,count:contacts.length,totalPages:1,currentPage:1}}}
      export async function quickCreateFinancialSupplierAction(input){const legal_name=input.legal_name.trim();let contact=contacts.find(c=>c.legal_name.toLowerCase()===legal_name.toLowerCase());if(!contact){contact={id:crypto.randomUUID(),legal_name,trade_name:null};contacts.push(contact)}return {ok:true,data:contact}}`;
    if(f.endsWith('/src/server/actions/financial-transaction.ts')) return 'export async function getMonthlySummaryMultiAction(){return {ok:true,data:{}}} export async function getFinancialChartDetailsAction(){return {ok:true,data:[]}}';
    if(f.endsWith('/src/server/actions/center-summary.ts')) return 'export async function getCenterSummaryAction(raw){window.__centerQuery=raw;return {ok:true,data:[{id:"c",name:"Imóvel São José",income:1200,expense:300,balance:900}]}}';
    if(f.endsWith('/src/server/actions/financial-report.ts')) return `export const getExtratoReportAction=async()=>({ok:true,data:${JSON.stringify(extrato)}});export const getIncomeExpenseReportAction=async()=>({ok:true,data:${JSON.stringify(income)}});export const getDemonstrativoReportAction=async()=>({ok:true,data:${JSON.stringify(dfc)}});`;
    if(f.endsWith('/src/server/actions/repair.ts')) return `let rows=[${JSON.stringify(repair)}];
      export async function listRepairsAction(){return {ok:true,data:{data:structuredClone(rows),count:rows.length,totalPages:1}}}
      export async function getRepairPropertiesAction(){return {ok:true,data:[${JSON.stringify(repair.property)}]}}
      export async function saveRepairAction(id,input){window.__savedRepair=input;const contacts=(await import('@/server/actions/financial-supplier')).listSuppliersAction;const supplier=(await contacts()).data.data.find(s=>s.id===input.supplier_id);const old=rows.find(r=>r.id===id);const saved={...${JSON.stringify(repair)},...input,supplier,professional:supplier.legal_name,id:id??'00000000-0000-4000-8000-000000000011',service_amount:Number(input.service_amount),materials_amount:Number(input.materials_amount),media:old?.media??[]};rows=old?rows.map(r=>r.id===id?saved:r):[saved,...rows];return {ok:true,data:structuredClone(saved)}}
      export async function deleteRepairAction(id){rows=rows.filter(r=>r.id!==id);return {ok:true,data:null}}
      export async function uploadRepairMediaAction(id,form){const media={id:crypto.randomUUID(),filename:form.get('file').name,stage:form.get('stage'),content_type:'image/png',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8XkAAAAASUVORK5CYII='};rows.find(r=>r.id===id).media.push(media);return {ok:true,data:media}}
      export async function deleteRepairMediaAction(id,mediaId){rows.find(r=>r.id===id).media=rows.find(r=>r.id===id).media.filter(m=>m.id!==mediaId);return {ok:true,data:null}}`;
  }}] });
let browser;
if(process.argv.includes('--serve')){
  await server.listen();console.log(`Demonstração de Reparos: ${server.resolvedUrls.local[0]}.tmp-e2e/correcoes44/index.html?view=repairs`);
  await new Promise(()=>{});
}
try {
  await server.listen(); browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.addInitScript(()=>{window.print=()=>{window.__printCalled=true};});
  const page=await context.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const url=view=>`${server.resolvedUrls.local[0]}.tmp-e2e/correcoes44/index.html?view=${view}`;
  await page.goto(url('repairs')); await page.getByText('Infiltração na cozinha',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Novo reparo',exact:true}).click();
  const dialog=page.locator('section[aria-labelledby="repair-title"]'); await dialog.getByText('Selecione o imóvel',{exact:true}).click();
  await page.getByPlaceholder('Pesquisar...',{exact:true}).fill('imovel sao jose');await page.locator('li').filter({hasText:'Imóvel São José'}).click();
  await dialog.getByLabel('Profissional ou empresa responsável',{exact:true}).fill('Fábio Rodrigues Gonçalves');
  await page.getByRole('option',{name:/Adicionar novo:/}).click();
  await dialog.locator('#repair-description').fill('Rachaduras e trincas nas paredes');
  await dialog.locator('#repair-service-amount').fill('120050');await dialog.locator('#repair-materials-amount').fill('30025');
  await dialog.locator('#repair-payment-method').fill('Pix');await dialog.locator('#repair-payment-conditions').fill('À vista');
  await dialog.getByRole('button',{name:'Salvar reparo'}).click();await dialog.getByText('Antes — problemas identificados',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__savedRepair.service_amount),1200.50);
  await dialog.locator('input[type=file]').first().setInputFiles({name:'antes.png',mimeType:'image/png',buffer:Buffer.from('test')});
  await dialog.getByRole('img',{name:'antes.png',exact:true}).waitFor();
  await page.screenshot({path:path.join(fixture,'reparo-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(fixture,'reparo-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(url('dfc'));await page.getByText(/Resultado \(Prejuízo\)/).waitFor();
  await page.getByRole('button',{name:'Alternar Analítico'}).click();await page.getByText(item.description,{exact:true}).waitFor();
  assert.ok(await page.getByText(/Resultado \(Prejuízo\)/).evaluate(el=>{
    const ctx=document.createElement('canvas').getContext('2d');ctx.fillStyle=getComputedStyle(el).color;ctx.fillRect(0,0,1,1);const [r,g]=ctx.getImageData(0,0,1,1).data;return r>g*2;
  }));
  await page.screenshot({path:path.join(fixture,'demonstrativo.png'),fullPage:true});
  await page.goto(url('center'));await page.locator('canvas').waitFor();assert.equal(await page.evaluate(()=>window.__centerQuery.startDate),'2026-10-01');
  await page.screenshot({path:path.join(fixture,'centros.png'),fullPage:true});
  for(const view of ['extrato','income']){
    await page.goto(url(view));await page.getByText('Total do Período',{exact:true}).waitFor();
    if(view==='income'){await page.getByRole('button',{name:'Alternar Analítico'}).click();await page.getByText('Total das Despesas',{exact:true}).waitFor();}
    const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Imprimir teste'}).click();const popup=await popupPromise;
    await popup.waitForFunction(()=>window.__printCalled===true);
    assert.equal(await popup.locator('meta[charset]').getAttribute('charset'),'utf-8');
    assert.ok((await popup.locator('body').innerText()).includes('Fábio Rodrigues Gonçalves'));
    assert.equal(await popup.locator('tfoot').evaluate(el=>getComputedStyle(el).display),'table-row-group');
    assert.equal(await popup.locator('.report-summary .max-w-md').evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
    assert.equal(await popup.locator('td.text-right').last().evaluate(el=>getComputedStyle(el).whiteSpace),'nowrap');
    await popup.pdf({path:path.join(fixture,`${view}-print.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true});await popup.close();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar teste'}).click();const download=await downloadPromise;await download.saveAs(path.join(fixture,`${view}-export.pdf`));
  }
  assert.deepEqual(errors,[]);console.log('Cadastro, upload, responsividade, gráfico por centro, Analítico expandido, cores, UTF-8 e PDFs de várias páginas verificados.');
}finally{await browser?.close();await server.close();}
