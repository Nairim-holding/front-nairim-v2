import { mkdtempSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import * as XLSX from 'xlsx';
import assert from 'node:assert/strict';

const root = realpathSync(process.cwd());
const fixture = mkdtempSync(join(root, '.center-excel-import-ui-'));
let server; let browser;
try {
  writeFileSync(join(fixture, 'mocks.tsx'), `
    import { parseFinancialCenterWorkbook } from '@/server/services/financial-center-import-parser';
    export const usePermissions = () => ({ can: () => true });
    export const useMessageContext = () => ({ showMessage: (text,kind) => { window.__messages.push({text,kind}); } });
    async function plan(form) {
      const file=form.get('file'), selected=form.has('sheets')?JSON.parse(form.get('sheets')):undefined;
      return parseFinancialCenterWorkbook(new Uint8Array(await file.arrayBuffer()),form.get('mode'),[],selected);
    }
    export async function previewFinancialCentersImportAction(form) {
      window.__previewCalls++;
      try { const data={...await plan(form),companyId:'test-company',companyName:'Empresa de teste',fingerprint:'reviewed'};window.__lastPreview=data;return {ok:true,data}; }
      catch(error){return {ok:false,error:error.message,status:400};}
    }
    export async function importFinancialCentersAction(form) {
      if(form.get('companyId')!=='test-company'||form.get('fingerprint')!=='reviewed')throw new Error('Prévia ausente');
      const data=await plan(form);if(data.issues.length)throw new Error('Importação inválida');
      window.__importCalls++;return {ok:true,data:{created:data.newCount,ignored:data.duplicateCount+data.existingCount}};
    }
  `);
  writeFileSync(join(fixture, 'main.tsx'), `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import Import from '@/components/domain/financial/CenterExcelImport';
    window.__messages=[];window.__previewCalls=0;window.__importCalls=0;window.__refreshes=0;
    createRoot(document.getElementById('root')).render(<main style={{padding:24}}><Import onImported={async()=>{window.__refreshes++;}}/></main>);
  `);
  const css=await postcss([tailwindcss({base:root})]).process(readFileSync(join(root,'src','app','globals.css'),'utf8'),{from:join(root,'src','app','globals.css')});
  writeFileSync(join(fixture,'style.css'),css.css);
  writeFileSync(join(fixture,'index.html'),'<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/style.css"/></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Imóveis da empresa'],[],['', 'ENDEREÇO'],[1,'Rua A'],[2,'Rua A'],['','Rua B']]),'Dominio');
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Nome'],['Rua C']]),'Wagner');
  const reference=process.env.CENTER_IMPORT_REFERENCE || join(fixture,'centros.xlsx');
  if(!process.env.CENTER_IMPORT_REFERENCE)XLSX.writeFile(book,reference);
  const invalidBook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(invalidBook,XLSX.utils.aoa_to_sheet([['Nome','Tipo'],['Centro A','Inválido']]),'Centros');
  const invalid=join(fixture,'invalido.xlsx');XLSX.writeFile(invalidBook,invalid);
  server=await createServer({configFile:false,root:fixture,cacheDir:join(fixture,'vite-cache'),esbuild:{jsx:'automatic'},resolve:{alias:[
    ...['@/contexts/PermissionsContext','@/contexts/MessageContext','@/server/actions/financial-center-import'].map(find=>({find,replacement:join(fixture,'mocks.tsx')})),{find:'@',replacement:join(root,'src')}]},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
  await server.listen();browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
  await page.getByRole('button',{name:'Importar Excel',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.ok(await page.getByRole('button',{name:'Importar 0 centro(s)',exact:true}).isDisabled());
  await page.getByLabel('Planilha Excel (até 2 MB)').setInputFiles(reference);
  await page.getByRole('button',{name:'Gerar prévia',exact:true}).click();
  await page.getByText('Destino: Empresa de teste.',{exact:false}).waitFor();
  const allPreview=await page.evaluate(()=>window.__lastPreview);
  assert.ok(allPreview.newCount>0);assert.equal(allPreview.issues.length,0);assert.ok(allPreview.duplicateCount>0);
  assert.equal(await page.getByRole('checkbox').count(),allPreview.sheets.length);
  assert.ok(allPreview.rows.some(row=>row.name.endsWith('(CR)'))&&allPreview.rows.some(row=>row.name.endsWith('(DB)')));
  assert.equal(await page.evaluate(()=>window.__importCalls),0,'Gerar prévia deve somente ler');
  const firstSheet=allPreview.sheets[0];await page.getByRole('checkbox',{name:firstSheet,exact:true}).uncheck();
  assert.equal(await page.getByRole('region',{name:'Prévia dos centros'}).count(),0,'Trocar abas deve invalidar a prévia');
  await page.getByRole('button',{name:'Gerar prévia',exact:true}).click();
  await page.getByText('Destino: Empresa de teste.',{exact:false}).waitFor();
  assert.ok(!(await page.evaluate(()=>window.__lastPreview.selectedSheets)).includes(firstSheet));
  await page.getByLabel('Quando a coluna Tipo não estiver preenchida').selectOption('EXPENSE');
  assert.equal(await page.getByRole('region',{name:'Prévia dos centros'}).count(),0);
  await page.getByRole('button',{name:'Gerar prévia',exact:true}).click();
  await page.getByText('Destino: Empresa de teste.',{exact:false}).waitFor();
  assert.ok(await page.evaluate(()=>window.__lastPreview.rows.every(row=>row.name.endsWith('(DB)'))));
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'A prévia deve caber no celular');
  if(process.env.CENTER_IMPORT_UI_SCREENSHOT)await page.screenshot({path:process.env.CENTER_IMPORT_UI_SCREENSHOT});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  assert.ok(await page.getByRole('button',{name:'Importar Excel',exact:true}).evaluate(button=>document.activeElement===button));
  await page.getByRole('button',{name:'Importar Excel',exact:true}).click();
  assert.equal(await page.getByRole('checkbox').count(),0,'Fechar deve limpar a seleção anterior');
  assert.ok(await page.getByRole('button',{name:'Gerar prévia',exact:true}).isDisabled());
  await page.getByLabel('Planilha Excel (até 2 MB)').setInputFiles(invalid);
  await page.getByRole('button',{name:'Gerar prévia',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Tipo inválido'}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Importar 0 centro(s)',exact:true}).isDisabled());
  await page.getByLabel('Planilha Excel (até 2 MB)').setInputFiles(reference);
  await page.getByRole('button',{name:'Gerar prévia',exact:true}).click();
  await page.getByText('Destino: Empresa de teste.',{exact:false}).waitFor();
  await page.getByRole('button',{name:/^Importar \d+ centro\(s\)$/}).click();
  await dialog.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.__importCalls),1);assert.equal(await page.evaluate(()=>window.__refreshes),1);
  assert.match(await page.evaluate(()=>window.__messages.at(-1).text),/Importação concluída/);
  assert.deepEqual(errors,[]);
  console.log('UI aprovada: prévia da planilha, abas, tipos CR/DB, erros, nenhuma escrita na prévia, celular, foco, fechar/reabrir e confirmação mockada com atualização da lista.');
} finally {
  if(browser)await browser.close();if(server)await server.close();
  const target=realpathSync(fixture);
  if(dirname(target)!==root||!basename(target).startsWith('.center-excel-import-ui-'))throw new Error('Diretório de teste fora do projeto.');
  rmSync(target,{recursive:true,force:true});
}
