import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=join(root,'.next','standalone','node_modules');
const seed=readFileSync(join(root,'scripts','seed-test2.mjs'),'utf8');

function fixture() {
  const directory=mkdtempSync(join(tmpdir(),'nairim-seed-runtime-'));
  const copied=new Set();
  const copyPackage=(name,requester=dirname(runtime))=>{
    let source;
    for(let parent=requester;parent.startsWith(dirname(runtime));parent=dirname(parent)){
      const candidate=join(parent,'node_modules',name);
      if(existsSync(join(candidate,'package.json'))){source=candidate;break;}
    }
    assert.ok(source,`Pacote ${name} ausente do standalone`);
    if(copied.has(source))return;
    copied.add(source);
    const target=join(directory,'node_modules',relative(runtime,source));
    mkdirSync(target,{recursive:true});cpSync(source,target,{recursive:true,dereference:true});
    const pkg=JSON.parse(readFileSync(join(source,'package.json'),'utf8'));
    for(const dep of Object.keys(pkg.dependencies??{}))if(!(dep in (pkg.optionalDependencies??{})))copyPackage(dep,source);
  };
  copyPackage('pg');
  assert.equal(existsSync(join(directory,'node_modules','bcryptjs')),false);
  return {directory,cleanup(){assert.ok(resolve(directory).startsWith(resolve(tmpdir())));rmSync(directory,{recursive:true,force:true});}};
}

test('seed via stdin carrega no runtime isolado com pg e sem bcryptjs instalado',()=>{
  const f=fixture();
  try {
    const result=spawnSync(process.execPath,['--input-type=module'],{cwd:f.directory,input:seed,encoding:'utf8',timeout:15000,env:{...process.env,DATABASE_URL:'postgresql://unused:unused@127.0.0.1:1/nairim_db'}});
    assert.equal(result.status,1,result.stderr);
    assert.match(result.stderr,/Seed permitido somente no banco nairim_test2_db/);
    assert.doesNotMatch(result.stderr,/ERR_MODULE_NOT_FOUND|Cannot find package/);
  } finally {f.cleanup();}
});

test('bcrypt incorporado consegue gerar senha no runtime que não possui o pacote',()=>{
  const f=fixture();
  try {
    writeFileSync(join(f.directory,'seed.mjs'),seed);
    writeFileSync(join(f.directory,'probe.mjs'),`
      import {seedTest2} from './seed.mjs';
      let hashed=false;
      const client={async query(sql,params){
        if(sql==='SELECT current_database() AS database')return {rows:[{database:'nairim_test2_db'}]};
        if(sql.startsWith('SELECT'))return {rows:[]};
        if(sql.startsWith('INSERT INTO "User"')){
          hashed=params.some(value=>typeof value==='string'&&/^\\$2[aby]\\$12\\$/.test(value));
          throw new Error('STOP_AFTER_HASH');
        }
        return {rows:[],rowCount:1};
      }};
      try{await seedTest2(client,{year:2026,adminPassword:'fixture-only-password-123456'});throw new Error('Senha não gerada');}
      catch(error){if(error.message!=='STOP_AFTER_HASH'||!hashed)throw error;console.log('HASH_READY');}
    `);
    const result=spawnSync(process.execPath,['probe.mjs'],{cwd:f.directory,encoding:'utf8',timeout:15000});
    assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/HASH_READY/);
  } finally {f.cleanup();}
});
