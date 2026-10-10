import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root=realpathSync(process.cwd()), fixture=mkdtempSync(join(root,'.correcoes-ui-'));
let server,browser;
try {
  writeFileSync(join(fixture,'mocks.tsx'), `
    export const useAuth=()=>({user:{id:'root',company_id:'a',role:'SUPER_ADMIN'}});
    export const useMessageContext=()=>({showMessage:(message,kind)=>(window.__messages??=[]).push({message,kind})});
    export const usePopupContext=()=>({showPopup:(title,message,onConfirm)=>window.__popup={title,message,onConfirm}});
    export async function getPropertyCloneCompaniesAction(){return {ok:true,data:window.__single?[{id:'a',name:'Empresa A'}]:[{id:'a',name:'Empresa A'},{id:'b',name:'Empresa B'}]};}
    export async function clonePropertiesAction(input){window.__clone=input;return {ok:true,data:input.company_ids.map(company=>({company,property:'Casa',ok:true}))};}
    export async function setInvestmentMonthBalanceAction(input){window.__balance=input;return {ok:true,data:null};}
  `);
  writeFileSync(join(fixture,'main.tsx'), `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import ThemeEditor from '@/components/admin/WhiteLabel/ThemeEditor';
    import Clone from '@/components/table/PropertyCloneControl';
    import LeaseTable from '@/app/dashboard/(cadastro)/locacoes/relatorios/_components/LeaseReportTable';
    import MonthBalance from '@/components/investimentos/MonthBalanceModal';
    function App(){const [tab,setTab]=useState('theme'); const [values,setValues]=useState({primary_color:'#8b5cf6',primary_color_dark:'#112233'});const [selected,setSelected]=useState(false);const [balanceOpen,setBalanceOpen]=useState(false);
      const rows=[6,7,8].map(month=>({row_id:'lease::2026-'+month,lease_id:'lease',reference_month:'2026-0'+month,agency_name:'Adiplan',property_title:'América, 389',gross_revenue:1800,received_amount:1800,discount_expense:100,penalty:0,property_tax_refund:0,condominium_income:100,withholding:0,agency_share:0,net_amount:1800,tenant_name:'Cliente',tenant_document:null,has_withholding:false}));
      return <main style={{padding:16}}><nav><button onClick={()=>setTab('theme')}>Tema</button><button onClick={()=>setTab('clone')}>Imóveis</button><button onClick={()=>setTab('lease')}>Locações</button><button onClick={()=>setTab('balance')}>Investimentos</button></nav>
      {tab==='theme'&&<ThemeEditor values={values} onChange={(key,value)=>setValues(previous=>({...previous,[key]:value}))}/>}
      {tab==='clone'&&<><label><input type='checkbox' checked={selected} onChange={event=>setSelected(event.target.checked)}/>Selecionar imóvel</label><Clone ids={selected?['property']:[]} onCloned={()=>setSelected(false)}/></>}
      {tab==='lease'&&<LeaseTable data={{rows,totals:{gross_revenue:5400,received_amount:5400,discount_expense:300,penalty:0,property_tax_refund:0,condominium_income:300,withholding:0,agency_share:0,net_amount:5400}}}/>}
      {tab==='balance'&&<><button onClick={()=>setBalanceOpen(true)}>Editar saldo teste</button>{balanceOpen&&<MonthBalance investment={{id:'vgbl',product:'VGBL',product_type:'PREVIDENCIA',issuer:'Emissor',institution_label:'Banco'}} year={2024} month={1} currentBalance={707318.13} isManual onClose={()=>setBalanceOpen(false)} onSaved={()=>setBalanceOpen(false)}/>}</>}
      </main>}
    createRoot(document.getElementById('root')).render(<App/>);
  `);
  const css=join(root,'.next','static','css');writeFileSync(join(fixture,'style.css'),readdirSync(css).filter(name=>name.endsWith('.css')).map(name=>readFileSync(join(css,name),'utf8')).join('\n'));
  writeFileSync(join(fixture,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  server=await createServer({configFile:false,root:fixture,cacheDir:join(fixture,'vite-cache'),esbuild:{jsx:'automatic'},resolve:{alias:[...['@/contexts','@/contexts/AuthContext','@/contexts/MessageContext','@/contexts/PopupContext','@/server/actions/property','@/server/actions/investment'].map(find=>({find,replacement:join(fixture,'mocks.tsx')})),{find:'@',replacement:join(root,'src')}]},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
  const primary=page.getByLabel('Primária',{exact:true});await primary.fill('#123456');await page.getByRole('button',{name:'Desfazer cor primária',exact:true}).click();assert.equal(await primary.inputValue(),'#8b5cf6');
  await page.getByRole('switch',{name:'Modo noturno'}).click();await primary.fill('#abcdef');await page.getByRole('button',{name:'Desfazer cor primária',exact:true}).click();assert.equal(await primary.inputValue(),'#112233');
  if(process.env.CORRECOES_UI_SCREENSHOT)await page.screenshot({path:resolve(process.env.CORRECOES_UI_SCREENSHOT),fullPage:true});
  await page.getByRole('button',{name:'Imóveis',exact:true}).click();const clone=page.getByRole('button',{name:'Duplicar imóveis selecionados'});assert.equal(await clone.isDisabled(),true);
  await page.getByLabel('Selecionar imóvel').check();await clone.click();await page.getByRole('dialog',{name:'Duplicar imóveis',exact:true}).waitFor();
  await page.getByText('Empresa B',{exact:true}).click();await page.getByRole('button',{name:'Duplicar',exact:true}).click();await page.waitForFunction(()=>!!window.__clone);assert.deepEqual(await page.evaluate(()=>window.__clone),{property_ids:['property'],company_ids:['a','b']});
  await page.getByRole('dialog').waitFor({state:'detached'});await page.evaluate(()=>{window.__single=true;window.__clone=null;});await page.getByLabel('Selecionar imóvel').check();await clone.click();await page.waitForFunction(()=>!!window.__clone);assert.equal(await page.getByRole('dialog').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.__clone.company_ids),['a']);
  await page.getByRole('button',{name:'Locações',exact:true}).click();const headers=await page.getByRole('columnheader').allTextContents();assert.equal(headers[2],'Mês/Ano');assert.equal(headers[headers.indexOf('IPTU')+1],'Condomínio (Receita)');
  assert.equal(await page.locator('tbody tr').count(),3);for(const reference of ['06/2026','07/2026','08/2026'])assert.ok((await page.locator('tbody').innerText()).includes(reference));
  await page.getByRole('button',{name:'Investimentos',exact:true}).click();await page.getByRole('button',{name:'Editar saldo teste'}).click();assert.match(await page.getByPlaceholder('0,00',{exact:true}).inputValue(),/707.318,13/);
  await page.getByRole('button',{name:'Excluir saldo',exact:true}).click();assert.equal(await page.evaluate(()=>window.__balance),undefined);await page.evaluate(()=>window.__popup.onConfirm());assert.deepEqual(await page.evaluate(()=>window.__balance),{investment_id:'vgbl',year:2024,month:1,balance:null});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.deepEqual(errors,[]);
  console.log('UI aprovada: desfazer cores claro/escuro, duplicar em uma ou várias empresas, competências e condomínio no relatório, exclusão de saldo com confirmação e celular.');
}finally{if(browser)await browser.close();if(server)await server.close();const target=realpathSync(fixture);if(dirname(target)!==root||!basename(target).startsWith('.correcoes-ui-'))throw new Error('Diretório fora do projeto');rmSync(target,{recursive:true,force:true});}
