import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root = realpathSync(process.cwd()); const fixture = mkdtempSync(join(root, '.table-transfer-ui-'));
let browser; let server;
try {
  writeFileSync(join(fixture,'mocks.tsx'), `
    export const usePathname=()=>'/empresa/dashboard/tipo-imovel';
    export const useAuth=()=>({user:{role:window.__role??'SUPER_ADMIN'}});
    export const usePermissions=()=>({can:()=>true});
    export const useMessageContext=()=>({showMessage:(message,type)=>window.__message={message,type}});
    export const usePopupContext=()=>({showPopup:(title,message,onConfirm)=>window.__popup={title,message,onConfirm}});
    export async function exportTableDataAction(key,scope){window.__export={key,scope};return {ok:true,data:JSON.stringify({scope,companies:[{slug:'a'},{slug:'b'}]})};}
    export async function previewTableImportAction(key,form){window.__preview={key,mode:form.get('mode'),file:JSON.parse(await form.get('file').text())};return {ok:true,data:{label:'Tipos de imóvel',total:2,companyCount:2,companies:[{name:'Empresa A',slug:'a'},{name:'Empresa B',slug:'b'}]}};}
    export async function importTableDataAction(key,form){window.__import={key,mode:form.get('mode')};return {ok:true,data:{created:1,updated:0,results:[{company:'Empresa A',slug:'a',ok:true,created:1,updated:0},{company:'Empresa B',slug:'b',ok:!window.__fail,created:0,updated:0,error:window.__fail?'Dependência ausente':undefined}]}};}
  `);
  writeFileSync(join(fixture,'main.tsx'), `import React from 'react';import {createRoot} from 'react-dom/client';import Transfer from '@/components/table/TableTransferActions';createRoot(document.getElementById('root')).render(<main style={{padding:16}}><Transfer/></main>);`);
  const css=join(root,'.next','static','css');
  writeFileSync(join(fixture,'style.css'),readdirSync(css).filter(name=>name.endsWith('.css')).map(name=>readFileSync(join(css,name),'utf8')).join('\n'));
  writeFileSync(join(fixture,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  server=await createServer({configFile:false,root:fixture,esbuild:{jsx:'automatic'},resolve:{alias:[...['next/navigation','@/contexts/AuthContext','@/contexts/PermissionsContext','@/contexts/MessageContext','@/contexts/PopupContext','@/server/actions/table-transfer'].map(find=>({find,replacement:join(fixture,'mocks.tsx')})),{find:'@',replacement:join(root,'src')}]},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
  await server.listen();browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const url='http://127.0.0.1:'+server.httpServer.address().port;
  await page.goto(url);
  await page.getByRole('combobox',{name:'Empresas para exportar'}).selectOption('all');
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar JSON',exact:true}).click();
  const download=await downloading;assert.ok(download.suggestedFilename().includes('todas-empresas'));
  assert.equal(JSON.parse(readFileSync(await download.path(),'utf8')).scope,'all');
  const upload=async(mode,formatVersion)=>{
    await page.getByRole('combobox',{name:'Destino da importação'}).selectOption(mode);
    await page.getByLabel('Arquivo JSON de Tipos de imóvel').setInputFiles({name:'cadastro.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({meta:{formatVersion}}))});
    await page.waitForFunction(()=>!!window.__popup);
    assert.equal(await page.evaluate(()=>window.__preview.mode),mode);
    assert.ok((await page.evaluate(()=>window.__popup.message)).includes('Empresa A (a), Empresa B (b)'));
    assert.equal(await page.evaluate(()=>window.__import),undefined,'Prévia não pode executar a importação');
    await page.evaluate(()=>window.__popup.onConfirm());
    await page.getByRole('dialog',{name:'Resultado da importação por empresa'}).waitFor();
    assert.equal(await page.evaluate(()=>window.__import.mode),mode);
  };
  await page.evaluate(()=>window.__fail=true);await upload('copy-all',1);
  const result=await page.getByRole('dialog').innerText();assert.ok(result.includes('Concluído')&&result.includes('Dependência ausente'));
  assert.equal(await page.getByRole('dialog').locator('tbody tr').count(),2);
  await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Fechar e atualizar a página'}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'Fechar e atualizar a página'}).click();
  await page.waitForFunction(()=>!window.__import);
  await upload('restore-all',2);assert.ok((await page.getByRole('dialog').innerText()).includes('Concluído'));
  await page.getByRole('button',{name:'Fechar e atualizar a página'}).click();await page.waitForFunction(()=>!window.__import);
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=window.innerWidth);
  await page.addInitScript(()=>window.__role='ADMIN');await page.reload();await page.getByRole('button',{name:'Importar JSON',exact:true}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'Destino da importação'}).count(),0);
  assert.equal(await page.getByRole('combobox',{name:'Empresas para exportar'}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('UI aprovada: exportação conjunta, dois modos de importação, confirmação antes de gravar, falhas por empresa, foco no modal, restrição a root e celular.');
} finally {
  if(browser)await browser.close();if(server)await server.close();const target=realpathSync(fixture);
  if(dirname(target)!==root||!basename(target).startsWith('.table-transfer-ui-'))throw new Error('Diretório de teste fora do projeto.');
  rmSync(target,{recursive:true,force:true});
}
