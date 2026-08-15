import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeBackupFileStore } from '@/infra/storage/node-backup-file-store';
import type { BackupPayload } from '@/core/entities/backup';

/**
 * Testes de integração (disco) do NodeBackupFileStore — porte do
 * `AUTO_BACKUP_DIR`/`fs.*` de api-nairim-v2/src/services/BackupService.ts.
 *  - grava/lista/lê com os nomes no padrão do backend;
 *  - rejeita path traversal, extensão inválida e arquivos de outras empresas.
 */

function mkPayload(seed: number): BackupPayload {
  const data = { properties: [{ id: `p${seed}`, company_id: 'c1' }] };
  return {
    meta: {
      app: 'nairim',
      formatVersion: 1,
      company_id: 'c1',
      company_name: 'Nairim',
      company_slug: 'nairim',
      exportedAt: new Date().toISOString(),
      checksum: 'x',
      counts: { properties: 1 },
    },
    data,
  };
}

/** Nome no formato do backend com timestamp fixo (sem depender do clock). */
function filenameFor(slug: string, stamp: string): string {
  return `backup-nairim-${slug}-auto-${stamp}.json`;
}

describe('NodeBackupFileStore', () => {
  let dir: string;
  let store: NodeBackupFileStore;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    store = new NodeBackupFileStore(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writeAutoBackup grava na pasta e devolve o nome no padrão', () => {
    const name = store.writeAutoBackup('nairim', mkPayload(1));
    expect(name).toMatch(/^backup-nairim-nairim-auto-.*\.json$/);
    const full = path.join(dir, name);
    expect(fs.existsSync(full)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(full, 'utf-8'));
    expect(parsed.meta.company_slug).toBe('nairim');
  });

  it('listAutoBackups retorna do mais recente para o mais antigo', () => {
    const a = filenameFor('nairim', '2026-01-01T00-00-00');
    const b = filenameFor('nairim', '2026-02-01T00-00-00');
    fs.writeFileSync(path.join(dir, a), '{}');
    fs.writeFileSync(path.join(dir, b), '{}');
    fs.utimesSync(path.join(dir, a), new Date('2026-01-01'), new Date('2026-01-01'));
    fs.utimesSync(path.join(dir, b), new Date('2026-02-01'), new Date('2026-02-01'));

    const list = store.listAutoBackups('nairim');
    expect(list.map((x) => x.name)).toEqual([b, a]);
    expect(list[0].size).toBe(2);

    // Não lista backups de outras empresas
    expect(store.listAutoBackups('outra')).toEqual([]);
  });

  it('readAutoBackup devolve o conteúdo para um arquivo válido', () => {
    const name = store.writeAutoBackup('nairim', mkPayload(2));
    const content = store.readAutoBackup('nairim', name);
    expect(content).toContain('"company_slug":"nairim"');
  });

  it('readAutoBackup rejeita path traversal (separadores de caminho)', () => {
    expect(store.readAutoBackup('nairim', '../../evil.json')).toBeNull();
    expect(store.readAutoBackup('nairim', 'C:\\evil.json')).toBeNull();
  });

  it('readAutoBackup rejeita arquivos de outras empresas', () => {
    const name = store.writeAutoBackup('nairim', mkPayload(3));
    expect(store.readAutoBackup('outra', name)).toBeNull();
  });

  it('readAutoBackup rejeita extensão não-json', () => {
    expect(store.readAutoBackup('nairim', filenameFor('nairim', 'x').replace('.json', '.txt'))).toBeNull();
  });

  it('readAutoBackup devolve null para arquivo inexistente', () => {
    expect(store.readAutoBackup('nairim', filenameFor('nairim', '2026-01-01T00-00-00'))).toBeNull();
  });
});