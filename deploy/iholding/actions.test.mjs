import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { load } from 'js-yaml';

const root = new URL('../../', import.meta.url);
const workflow = load(readFileSync(new URL('.github/workflows/deploy-iholding.yml', root), 'utf8'));
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

test('workflow executa somente iholding e publica front e migrations do mesmo commit', () => {
  assert.deepEqual(workflow.on.push.branches, ['iholding']);
  assert.equal(workflow.jobs.imagem.if, "github.ref == 'refs/heads/iholding'");
  assert.deepEqual(workflow.jobs.imagem.strategy.matrix.include.map(item => item.target), ['runner', 'operations']);
  assert.equal(workflow.jobs.deploy.needs, 'imagem');
  assert.match(workflow.jobs.deploy.steps[0].with.script, /cd \/var\/www\/iholding/);
  assert.doesNotMatch(workflow.jobs.deploy.steps[0].with.script, /reset --hard|front-nairim-v2/);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
});

for (const failure of ['', 'migrate', 'up']) {
  test(`deploy com Docker simulado: ${failure || 'sucesso'}`, () => {
    const temp = mkdtempSync(join(tmpdir(), 'iholding-actions-'));
    try {
      mkdirSync(join(temp, 'deploy', 'iholding'), { recursive: true });
      writeFileSync(join(temp, 'deploy', 'iholding', 'deploy-images.sh'), readFileSync(new URL('deploy/iholding/deploy-images.sh', root)));
      const initial = 'POSTGRES_PASSWORD=preservar\nJWT_SECRET=preservar\n';
      writeFileSync(join(temp, '.env.iholding'), initial);
      const command = `
        cd() { builtin cd "$@"; PWD=/var/www/iholding; }
        docker() {
          printf '%s\\n' "$*" >> trace.txt
          if [[ "$1" == login ]]; then cat >/dev/null; fi
          if [[ "$*" == *"run --rm --no-deps iholding-migrate"* && "$TEST_FAILURE" == migrate ]]; then return 9; fi
          if [[ "$*" == *"up -d"* && "$TEST_FAILURE" == up ]]; then return 9; fi
        }
        export -f cd docker
        bash deploy/iholding/deploy-images.sh
      `;
      const result = spawnSync(bash, ['-c', command], { cwd: temp, encoding: 'utf8', env: { ...process.env, DEPLOY_SHA: 'a'.repeat(40), GHCR_USER: 'test', GHCR_TOKEN: 'test-token', TEST_FAILURE: failure } });
      assert.equal(result.status, failure ? 9 : 0, result.stderr);
      const trace = readFileSync(join(temp, 'trace.txt'), 'utf8');
      assert.doesNotMatch(trace, /test-token| build | down |--volumes|bootstrap/);
      assert.ok(trace.indexOf('pull iholding-front') < trace.indexOf('run --rm --no-deps iholding-migrate'));
      const env = readFileSync(join(temp, '.env.iholding'), 'utf8');
      assert.ok(env.startsWith(initial));
      if (failure) assert.equal(env, initial);
      else assert.match(env, /IHOLDING_FRONT_IMAGE=ghcr.io\/nairim-holding\/front-nairim-v2:iholding-front-a{40}/);
      if (failure === 'migrate') assert.doesNotMatch(trace, /up -d/);
      else assert.match(trace, /--no-build --no-deps --wait/);
      assert.doesNotMatch(result.stdout, /test-token|POSTGRES_PASSWORD/);
    } finally {
      assert.ok(resolve(temp).startsWith(resolve(tmpdir())));
      rmSync(temp, { recursive: true, force: true });
    }
  });
}
