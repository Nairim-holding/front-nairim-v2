import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const scripts = fileURLToPath(new URL('./', import.meta.url));
const example = fileURLToPath(new URL('../../.env.iholding.example', import.meta.url));
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const shellPath = path => process.platform === 'win32'
  ? path.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`).replaceAll('\\', '/')
  : path;

function fixture() {
  const folder = mkdtempSync(join(tmpdir(), 'iholding-startup-'));
  const scriptsFolder = join(folder, 'deploy', 'iholding');
  mkdirSync(scriptsFolder, { recursive: true });
  for (const script of ['up.sh', 'create-env.sh']) copyFileSync(join(scripts, script), join(scriptsFolder, script));
  copyFileSync(example, join(folder, '.env.iholding.example'));
  const bin = join(folder, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'docker'), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$IHOLDING_TEST_COMMAND_LOG"
case "$*" in
  *'build iholding-front iholding-migrate'*) if [[ "\${IHOLDING_TEST_FAIL_BUILD:-0}" = 1 ]]; then exit 9; fi ;;
  *'SELECT COUNT(*) FROM "User"'*) printf '%s\\n' "\${IHOLDING_TEST_USER_COUNT:-0}" ;;
esac
`);
  chmodSync(join(bin, 'docker'), 0o755);
  const log = join(folder, 'commands.log');
  return {
    folder,
    run(script, settings = {}) {
      return execFileSync(bash, ['-c', 'export PATH="$1:$PATH"; bash "$2"', 'iholding-test',
        shellPath(bin), shellPath(join(scriptsFolder, script))], {
        encoding: 'utf8', env: { ...process.env, IHOLDING_TEST_COMMAND_LOG: shellPath(log), ...settings },
      });
    },
    commands: () => readFileSync(log, 'utf8'),
    cleanup: () => rmSync(folder, { recursive: true, force: true }), // Pasta criada por mkdtemp dentro de tmpdir.
  };
}

test('criacao do env gera segredos unicos e nunca sobrescreve um arquivo existente', () => {
  const fixtureData = fixture();
  try {
    const output = fixtureData.run('create-env.sh');
    const filename = join(fixtureData.folder, '.env.iholding');
    const content = readFileSync(filename, 'utf8');
    const secrets = [...content.matchAll(/^(?:POSTGRES_PASSWORD|MONGODB_LOGS_PASSWORD|JWT_SECRET|CRON_SECRET|MINIO_ROOT_PASSWORD|MINIO_SECRET_KEY|BOOTSTRAP_ADMIN_PASSWORD)=([a-f0-9]{64})$/gm)].map(match => match[1]);
    assert.equal(secrets.length, 7);
    assert.equal(new Set(secrets).size, 7);
    assert.ok(secrets.every(secret => !output.includes(secret)));
    fixtureData.run('create-env.sh');
    assert.equal(readFileSync(filename, 'utf8'), content);
  } finally { fixtureData.cleanup(); }
});

test('comando unico inicializa o administrador somente em instalacoes vazias', () => {
  for (const count of ['0', '1']) {
    const fixtureData = fixture();
    try {
      copyFileSync(example, join(fixtureData.folder, '.env.iholding'));
      fixtureData.run('up.sh', { IHOLDING_TEST_USER_COUNT: count });
      const commands = fixtureData.commands();
      assert.ok(commands.indexOf('config --quiet') < commands.indexOf('build iholding-front'));
      assert.ok(commands.indexOf('run --rm iholding-migrate') < commands.indexOf('run --rm iholding-storage-init'));
      assert.equal(commands.includes('run --rm iholding-bootstrap'), count === '0');
      assert.ok(commands.includes('up -d --no-build --wait --wait-timeout 300'));
    } finally { fixtureData.cleanup(); }
  }
});

test('falha no build interrompe a instalacao antes de iniciar bancos ou servicos', () => {
  const fixtureData = fixture();
  try {
    copyFileSync(example, join(fixtureData.folder, '.env.iholding'));
    assert.throws(() => fixtureData.run('up.sh', { IHOLDING_TEST_FAIL_BUILD: '1' }));
    assert.ok(!fixtureData.commands().includes('up -d'));
  } finally { fixtureData.cleanup(); }
});
