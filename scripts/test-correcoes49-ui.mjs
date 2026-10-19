import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
const root=realpathSync(process.cwd()),scratch=join(root,'.tmp-e2e');mkdirSync(scratch,{recursive:true});const fixture=mkdtempSync(join(scratch,'correcoes49-ui-'));
let server,browser;
try {
 writeFileSync(join(fixture,'mocks.tsx'),`
  import React from 'react';
  export const useRouter=()=>({push:()=>{},back:()=>{},refresh:()=>{}});
  export const usePathname=()=>'/dashboard';
  export function Link({href,children,...props}){return <a href={href} {...props} onClick={event=>{event.preventDefault();props.onClick?.(event);}}>{children}</a>}; export default Link;
  export const usePermissions=()=>({can:()=>true});
  export const useAuth=()=>({user:{id:'root',company_id:'a',role:'SUPER_ADMIN'}});
  export const useMessageContext=()=>({showMessage:(message)=>window.__messages.push(message)});
  export const useTheme=()=>({isDark:false,toggleTheme:()=>{}});
  export async function getLeaseFinancialHistoryAction(){return {ok:true,data:{lease:{id:'lease',contract_number:'4423/25',property_title:'Imóvel teste',tenant_name:'Locatário',canceled:false},
    totals:Object.fromEntries(['SETTLED','PENDING','OVERDUE','CANCELED'].map(key=>[key,{amount:100,count:1}])),candidates:[],
    rows:Array.from({length:80},(_,i)=>({id:''+i,installment:'1/12',description:'Lançamento '+i,type:i%2?'INCOME':'EXPENSE',recurring:i<2,eventDate:'2026-10-01',dueDate:'2026-10-10',amount:150,status:'COMPLETED',situation:'SETTLED',situationLabel:i%2?'Recebido':'Pago',canceled:false}))}};}
  export async function linkTransactionsToLeaseAction(){return {ok:true,data:{linked:0}};}
  export async function getLeaseExpiryAlertsAction(){return {ok:true,data:[{leaseId:'lease',propertyTitle:'Rua Maceió, 309',tenantName:'Inquilino teste',endDate:'2026-10-31',daysRemaining:14,adjustmentIndexName:'IPCA',canDismiss:false}]};}
  export async function getOverdueLeaseAlertsAction(){return {ok:true,data:{items:[{transaction_id:'late',lease_id:'lease',property_title:'Casa atrasada',agency_name:'Imobiliária',days_overdue:40,due_date:'2026-09-10'}],total:1,critical:1,amount:200}};}
  export async function acknowledgeLeaseExpiryAction(){return {ok:true,data:null};}
  export const getMyBrandingAction=async()=>({ok:true,data:{company_name:'Teste'}});
  export const recordDataExportAction=async()=>({ok:true});
  export const auditPreparedExport=async(_input,prepare)=>{const result=await prepare();result?.deliver?.();};
  export const Empty=()=>null;
 `);
 writeFileSync(join(fixture,'main.tsx'),`
  import React,{useState,useCallback} from 'react';import {createRoot} from 'react-dom/client';
  import Toast from '@/components/feedback/Toast';import DateInput from '@/components/ui/Input/DateInput';
  import RoiSaleScenario from '@/app/dashboard/(financeiro)/roi/_components/RoiSaleScenario';
  import {computePropertyRoi} from '@/core/entities/property-roi';
  import History from '@/components/domain/leases/LeaseFinancialHistoryModal';
  import {LeaseExpiryList} from '@/components/domain/lease-overdue/LeaseExpiryAlerts';
  import QuickRecordField from '@/components/ui/QuickRecordField';
  import QuickCreateAutocomplete from '@/components/ui/QuickCreateAutocomplete';
  import DynamicForm from '@/components/form/DynamicForm';
  import DashboardShell from '@/components/layout/DashboardShell';
  import * as browserSession from '@/utils/browser-session';
  window.__session=browserSession;window.__messages=[];
  const row={propertyId:'property',propertyTitle:'Barão do Rio Branco, 246',...computePropertyRoi({purchaseValue:68662.48,itbi:1000,registry:1000,initialRenovation:0,iptu:0,insurance:0,commission:0,periodicMaintenance:0,vacancyMonths:0,monthsLeased:12,rentReceived:12000,periodMonths:12})};
  const formPrefill={category:'income'};
  const formFields=[{field:'category',label:'Categoria Aluguel (Financeiro)',type:'custom',required:true,defaultValue:'',render:(value,_form,onChange)=><QuickCreateAutocomplete ariaLabel='Categoria preenchida' value={value||''} onChange={onChange} options={[{value:'income',label:'Receitas'}]} openOnFocus={!value} size='md'/>}];
  function App(){const [tab,setTab]=useState('roi');const [toast,setToast]=useState(false);const [date,setDate]=useState('2026-10-17');const [quick,setQuick]=useState('');const [category,setCategory]=useState('income');const close=useCallback(()=>setToast(false),[]);
    return <main style={{padding:16}}><nav style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:20}}>{['roi','date','toast','history','expiry','quick','form','menu'].map(name=><button key={name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
    {tab==='roi'&&<RoiSaleScenario rows={[row]}/>}
    {tab==='date'&&<DateInput id='start' label='Data início' value={date} onChange={e=>setDate(e.target.value)} full/>}
    {tab==='toast'&&<><button onClick={()=>setToast(true)}>Mostrar mensagem</button>{toast&&<Toast toast={{id:1,text:'Mensagem para leitura',type:'error',duration:1400}} onClose={close}/>}</>}
    {tab==='history'&&<History leaseId='lease' onClose={()=>setTab('roi')}/>}
    {tab==='expiry'&&<LeaseExpiryList items={[{leaseId:'lease',propertyTitle:'Rua Maceió, 309',tenantName:'Inquilino teste',endDate:'2026-10-31',daysRemaining:14,adjustmentIndexName:'IPCA',canDismiss:false}]} busy={null} acknowledge={()=>{}}/>}
    {tab==='quick'&&<><QuickRecordField resource='owners' label='Proprietário' value={quick} onChange={setQuick} options={[]}/><p data-testid='quick-value'>{quick}</p><QuickCreateAutocomplete ariaLabel='Categoria Aluguel' openOnFocus={!category} value={category} onChange={setCategory} options={[{value:'income',label:'Receitas'}]} size='md'/></>}
    {tab==='form'&&<DynamicForm resource='properties' title='Valores e Condições' basePath='/dashboard/imoveis' mode='create' fields={formFields} prefill={formPrefill} onSubmit={async()=>({})}/>}
    {tab==='menu'&&<DashboardShell><p>Conteúdo da página</p></DashboardShell>}
    </main>}
  createRoot(document.getElementById('root')).render(<App/>);
 `);
 const css=await postcss([tailwindcss({base:root,optimize:false})]).process(readFileSync(join(root,'src/app/globals.css'),'utf8'),{from:join(root,'src/app/globals.css')});writeFileSync(join(fixture,'style.css'),css.css);
 writeFileSync(join(fixture,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 server=await createServer({configFile:false,root:fixture,define:{'process.env':'{}'},cacheDir:join(fixture,'cache'),esbuild:{jsx:'automatic'},resolve:{alias:[
  ...['next/navigation','next/link','@/contexts/PermissionsContext','@/contexts/AuthContext','@/contexts/ThemeContext','@/contexts/MessageContext','@/server/actions/lease','@/server/actions/lease-expiry','@/server/actions/lease-overdue','@/server/actions/company','@/lib/audit-export'].map(find=>({find,replacement:join(fixture,'mocks.tsx')})),
  {find:'../Logo',replacement:join(fixture,'empty.tsx')},{find:'../CompanySwitcher',replacement:join(fixture,'empty.tsx')},{find:'@/components/table/TableTransferActions',replacement:join(fixture,'empty.tsx')},
  {find:'@/components/layout/Logo',replacement:join(fixture,'empty.tsx')},{find:'@/components/layout/CompanySwitcher',replacement:join(fixture,'empty.tsx')},{find:'./LeaseNotificationActions',replacement:join(fixture,'empty.tsx')},
  {find:'@',replacement:join(root,'src')}]},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
 writeFileSync(join(fixture,'empty.tsx'),'export default function Empty(){return null;}');
 writeFileSync(join(fixture,'bell.tsx'),`import React from 'react';export default function Bell({onNavigate}){return <a href='#alerts' onClick={onNavigate}>Ver central de alertas</a>}`);
 await server.listen();browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.httpServer.address().port;await page.goto(url);
 const purchase=page.getByRole('textbox',{name:'Valor de Compra — Barão do Rio Branco, 246'});await purchase.waitFor();assert.match(await purchase.inputValue(),/68.662,48/);
 const before=await page.locator('tbody').innerText();await purchase.fill('10000000');assert.notEqual(await page.locator('tbody').innerText(),before);assert.match(await page.locator('tbody').innerText(),/100.000,00/);
 await page.getByRole('button',{name:'date',exact:true}).click();const input=page.getByRole('textbox',{name:'Data início',exact:true});await input.click();await input.press('End');for(let i=0;i<10;i++)await input.press('Backspace');assert.equal(await input.inputValue(),'');await input.fill('17/10/2026');await input.press('Home');await input.press('ArrowRight');await input.press('Delete');assert.equal(await input.inputValue(),'1/10/2026');
 await page.getByRole('button',{name:'roi',exact:true}).click();assert.match(await purchase.inputValue(),/68.662,48/);
 await page.getByRole('button',{name:'toast',exact:true}).click();await page.getByRole('button',{name:'Mostrar mensagem'}).click();await page.getByRole('button',{name:'Pausar tempo da mensagem'}).click();await page.waitForTimeout(1800);assert.equal(await page.getByRole('status').count(),1);await page.getByRole('button',{name:'Retomar tempo da mensagem'}).click();await page.getByRole('status').waitFor({state:'detached',timeout:2500});
 await page.getByRole('button',{name:'Mostrar mensagem'}).click();await page.getByRole('button',{name:'Pausar tempo da mensagem'}).click();await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.getByRole('status').waitFor({state:'detached'});
 await page.getByRole('button',{name:'quick',exact:true}).click();const owner=page.getByRole('textbox',{name:'Proprietário'});await owner.fill('Novo Proprietário');await page.getByRole('option').click();assert.equal(await page.getByTestId('quick-value').innerText(),'__new__:Novo Proprietário');assert.ok((await page.locator('body').innerText()).includes('provisórios'));
 const category=page.getByRole('textbox',{name:'Categoria Aluguel'});await category.focus();assert.equal(await page.getByRole('listbox').count(),0);assert.equal(await category.inputValue(),'Receitas');await category.click();await page.getByRole('listbox').waitFor();await category.press('Escape');
 await page.getByRole('button',{name:'form',exact:true}).click();const filled=page.getByRole('textbox',{name:'Categoria preenchida'});await filled.waitFor();await page.waitForTimeout(400);assert.equal(await filled.inputValue(),'Receitas');assert.equal(await page.getByRole('listbox').count(),0);assert.ok((await page.locator('label').allTextContents()).some(text=>text.includes('Categoria Aluguel (Financeiro)*')));
 await page.getByRole('button',{name:'expiry',exact:true}).click();assert.ok((await page.locator('body').innerText()).includes('Vencimento: 31/10/2026'));assert.ok((await page.locator('body').innerText()).includes('Índice de reajuste: IPCA'));
 await page.getByRole('button',{name:'history',exact:true}).click();await page.getByText('Despesa Recorrente',{exact:true}).waitFor();assert.equal(await page.getByText('Receita Recorrente',{exact:true}).count(),1);
 assert.equal(await page.getByText('Pago',{exact:true}).first().evaluate(el=>{const ctx=document.createElement('canvas').getContext('2d');ctx.fillStyle=getComputedStyle(el).color;ctx.fillRect(0,0,1,1);const [r,g,b]=ctx.getImageData(0,0,1,1).data;return r>g*1.5&&r>b*1.5;}),true);
 const header=page.getByRole('columnheader',{name:'Parcela',exact:true});const y=(await header.boundingBox()).y;const intro=page.getByText('Recebido',{exact:true}).first();const introY=(await intro.boundingBox()).y;
 await page.getByTestId('lease-history-scroll').evaluate(el=>{el.scrollTop=700});await page.waitForTimeout(100);assert.ok(Math.abs((await header.boundingBox()).y-y)<2);assert.ok(Math.abs((await intro.boundingBox()).y-introY)<2);
 if(process.env.CORRECOES49_UI_SCREENSHOT)await page.screenshot({path:resolve(process.env.CORRECOES49_UI_SCREENSHOT)});
 await page.getByRole('button',{name:'Fechar',exact:true}).last().click();
 await page.getByRole('button',{name:'menu',exact:true}).click();await page.getByRole('button',{name:'Expandir menu'}).waitFor();await page.getByRole('button',{name:'Expandir menu'}).click();await page.getByRole('button',{name:/alertas de locações/}).click();await page.getByText('Repasses em atraso',{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes('Índice de reajuste: IPCA'));await page.getByRole('link',{name:'Ver central de alertas',exact:true}).click();await page.getByRole('button',{name:'Expandir menu'}).waitFor();
 await page.getByRole('button',{name:'Expandir menu'}).click();await page.getByRole('link',{name:'Resumo',exact:true}).click({button:'right'});await page.keyboard.press('Escape');assert.equal(await page.getByRole('link',{name:'Resumo',exact:true}).isVisible(),true);await page.getByRole('link',{name:'Resumo',exact:true}).click();await page.getByRole('button',{name:'Expandir menu'}).waitFor();
 // Real browser documents: reload/live new tab allowed; restored storage+cookie with all peers closed denied.
 await page.evaluate(()=>window.__session.beginBrowserSession('root'));await page.reload();assert.equal(await page.evaluate(()=>window.__session.claimBrowserSession('root')),true);
 const second=await context.newPage();await second.goto(url);assert.equal(await second.evaluate(()=>window.__session.claimBrowserSession('root')),true);
 const storage=await page.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage)));await second.close();await page.close();const restored=await context.newPage();await restored.goto(url);await restored.evaluate(items=>Object.entries(items).forEach(([key,value])=>sessionStorage.setItem(key,value)),storage);assert.equal(await restored.evaluate(()=>window.__session.claimBrowserSession('root')),false);
 await restored.setViewportSize({width:390,height:844});await restored.getByRole('button',{name:'quick',exact:true}).click();assert.equal(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('Interface aprovada: ROI temporário e restauração, datas sem barras presas, pausa/retomada/fechamento das mensagens, cadastro rápido, categoria fechada, alerta com data/índice, histórico fixo e recorrentes, menu/contexto/central e sessão após recarga, nova aba e restauração do navegador.');
}finally{if(browser)await browser.close();if(server)await server.close();const target=realpathSync(fixture);if(dirname(target)!==scratch||!basename(target).startsWith('correcoes49-ui-'))throw new Error('Diretório de teste fora da área temporária.');rmSync(target,{recursive:true,force:true});}
