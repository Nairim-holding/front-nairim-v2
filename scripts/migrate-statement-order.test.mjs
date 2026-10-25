import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { load } from 'js-yaml';

const root = new URL('../', import.meta.url);
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const shellPath = path => process.platform === 'win32' ? path.replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase()).replaceAll('\\','/') : path;
const workflow = load(readFileSync(new URL('.github/workflows/deploy.yml',root),'utf8'));
test('workflow aplica e verifica a migração antes do primeiro restart', () => {
  const script = workflow.jobs.deploy.steps[0].with.script;
  assert.ok(script.includes('bash scripts/migrate-statement-order.sh'));
  assert.ok(script.indexOf('bash scripts/migrate-statement-order.sh') < script.indexOf('docker compose up'));
});
for (const failure of ['', 'missing', 'migrate', 'check']) test(`orquestração sem Docker real: ${failure || 'sucesso'}`, () => {
  const folder = mkdtempSync(join(tmpdir(),'nairim-migration-'));
  try {
    mkdirSync(join(folder,'scripts'),{recursive:true});
    const migrationDir=join(folder,'prisma','migrations','20261025000000_transaction_statement_order');mkdirSync(migrationDir,{recursive:true});
    for(const file of ['migrate-statement-order.sh','apply-statement-order-migration.mjs','check-statement-order-migration.mjs'])copyFileSync(new URL('scripts/'+file,root),join(folder,'scripts',file));
    copyFileSync(new URL('prisma/migrations/20261025000000_transaction_statement_order/migration.sql',root),join(migrationDir,'migration.sql'));
    const command=`
      docker() {
        if [[ "$1" == compose ]]; then
          echo "resolve \${@: -1}" >> "$TEST_TRACE"
          if [[ "$TEST_FAILURE" == missing && "\${@: -1}" == front-nairim-homolog ]]; then return 0; fi
          echo "container-\${@: -1}"
        else
          payload=$(cat)
          if [[ "$payload" == *applyStatementOrderMigration* ]]; then
            echo migrate >> "$TEST_TRACE"
            if [[ "$TEST_FAILURE" == migrate ]]; then return 9; fi
          else
            echo check >> "$TEST_TRACE"
            if [[ "$TEST_FAILURE" == check ]]; then return 8; fi
          fi
        fi
      }
      export -f docker
      bash scripts/migrate-statement-order.sh
    `;
    const trace=join(folder,'trace.txt');
    const result=spawnSync(bash,['-c',command],{cwd:folder,encoding:'utf8',env:{...process.env,TEST_FAILURE:failure,TEST_TRACE:shellPath(trace)}});
    assert.equal(result.status,failure==='missing'?1:failure==='migrate'?9:failure==='check'?8:0,result.stderr);
    const calls=readFileSync(trace,'utf8').trim().split(/\r?\n/);
    assert.deepEqual(calls.slice(0,3),['resolve front-nairim','resolve front-nairim-test','resolve front-nairim-homolog']);
    assert.deepEqual(calls.slice(3),failure==='missing'?[]:failure==='migrate'?['migrate']:failure==='check'?['migrate','check']:['migrate','check','migrate','check','migrate','check']);
  } finally {
    assert.ok(resolve(folder).startsWith(resolve(tmpdir())));
    rmSync(folder,{recursive:true,force:true});
  }
});
