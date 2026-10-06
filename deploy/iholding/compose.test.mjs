import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'iholding-compose-'));
const envFile = join(temp, 'validation.env');
const composeFile = join(root, 'docker-compose.iholding.yml');
const dummyEnv = readFileSync(join(root, '.env.iholding.example'), 'utf8')
  .replace(/^MINIO_IMAGE=.*$/m, 'MINIO_IMAGE=minio/minio:validation-only')
  .replace(/^MINIO_MC_IMAGE=$/m, 'MINIO_MC_IMAGE=minio/mc:validation-only')
  .replace(/^(POSTGRES_PASSWORD|MONGODB_LOGS_PASSWORD|JWT_SECRET|CRON_SECRET|MINIO_ROOT_PASSWORD|MINIO_SECRET_KEY)=$/gm, '$1=validation_only_0123456789');
writeFileSync(join(temp, 'config.json'), '{}');
writeFileSync(envFile, dummyEnv);
const args = ['--config', temp, 'compose', '--env-file', envFile, '-f', composeFile, 'config'];

test('Compose resolve isolamento, conexoes internas, rotas e volumes sem motor Docker', () => {
  try {
    const config = JSON.parse(execFileSync('docker', [...args, '--format', 'json'], { encoding: 'utf8' }));
    assert.equal(config.name, 'iholding');
    for (const service of Object.values(config.services)) {
      assert.ok(!service.ports?.length, 'nenhum servico deve publicar porta na VPS');
      assert.ok(!service.container_name, 'nomes devem ser gerenciados pelo projeto');
      assert.ok(!service.env_file, 'nao carregar .env da Nairim');
    }
    for (const volume of Object.values(config.volumes)) {
      assert.ok(volume.name.startsWith('iholding_'));
      assert.ok(!volume.external);
    }
    assert.equal(config.networks.default.name, 'iholding_default');
    assert.equal(config.networks['traefik-public'].external, true);
    const front = config.services['iholding-front'];
    assert.equal(front.build.args.NEXT_PUBLIC_COMPANY_SLUG, 'iholding');
    assert.equal(front.environment.BASE_URL, 'https://iholding.com.br');
    assert.equal(front.environment.MINIO_PUBLIC_URL, 'https://cdn.iholding.com.br');
    assert.equal(new URL(front.environment.DATABASE_URL).hostname, 'iholding-postgres');
    assert.equal(new URL(front.environment.MONGODB_LOGS_URI).hostname, 'iholding-mongodb');
    assert.ok(!('BOOTSTRAP_ADMIN_PASSWORD' in front.environment));
    assert.ok(!('MINIO_ROOT_PASSWORD' in front.environment));
    assert.equal(front.labels['traefik.http.routers.iholding-front.rule'], 'Host(`iholding.com.br`)');
    assert.equal(front.depends_on['iholding-migrate'].condition, 'service_completed_successfully');
    const worker = config.services['iholding-logs-worker'];
    assert.equal(worker.environment.DATABASE_URL, front.environment.DATABASE_URL);
    assert.equal(worker.environment.MONGODB_LOGS_URI, front.environment.MONGODB_LOGS_URI);
    assert.equal(worker.environment.MONGODB_LOGS_DATABASE, 'iholding_logs');
    assert.equal(config.services['iholding-minio'].labels['traefik.http.routers.iholding-cdn.rule'], 'Host(`cdn.iholding.com.br`)');
    assert.equal(config.services['iholding-postgres'].networks['traefik-public'], undefined);
    assert.equal(config.services['iholding-mongodb'].networks['traefik-public'], undefined);

    writeFileSync(envFile, dummyEnv.replace(/^JWT_SECRET=.*$/m, 'JWT_SECRET='));
    assert.throws(() => execFileSync('docker', [...args, '--quiet'], { encoding: 'utf8', stdio: 'pipe' }), /Configure JWT_SECRET/);
  } finally {
    // Caminho criado por mkdtemp, sempre dentro do diretorio temporario.
    rmSync(temp, { recursive: true, force: true });
  }
});
