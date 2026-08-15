import { describe, it, expect, vi } from 'vitest';
import type { BackupRepository } from '@/core/repositories/backup-repository';
import type { BackupFileStore } from '@/core/storage/backup-file-store';
import type { AutoBackupInfo, BackupPayload, RestoreOutcome } from '@/core/entities/backup';
import { BACKUP_FORMAT_VERSION } from '@/core/entities/backup';
import {
  DownloadAutoBackupUseCase,
  ExportBackupUseCase,
  ListAutoBackupsUseCase,
  RestoreBackupUseCase,
} from '@/core/use-cases/backup/crud';
import {
  autoBackupPrefix,
  buildAutoBackupFilename,
  buildChecksum,
  toAutoBackupStamp,
} from '@/core/utils/backup-filename';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Testes do módulo Backup (Módulo 12).
 *  - Helpers puros (checksum SHA-256, nomes de arquivo).
 *  - RestoreBackupUseCase: validações fiéis ao BackupService e orquestração
 *    (auto-backup ANTES da transação destrutiva, mensagem com contagem).
 *  - Delegação demais use-cases.
 */

function makePayload(overrides: Partial<BackupPayload> = {}): BackupPayload {
  const data = {
    properties: [{ id: 'p1', company_id: 'c1', title: 'Casa' }],
    owners: [{ id: 'o1', company_id: 'c1', name: 'João' }],
  };
  return {
    meta: {
      app: 'nairim',
      formatVersion: BACKUP_FORMAT_VERSION,
      company_id: 'c1',
      company_name: 'Nairim',
      company_slug: 'nairim',
      exportedAt: '2026-08-09T12:00:00.000Z',
      checksum: buildChecksum(data),
      counts: { properties: 1, owners: 1 },
    },
    data,
    ...overrides,
  };
}

class InMemoryBackupRepo implements BackupRepository {
  company: { id: string; name: string; slug: string } | null = { id: 'c1', name: 'Nairim', slug: 'nairim' };
  exportCalled = 0;
  restoreCalled = 0;
  restoredPayload: BackupPayload | null = null;

  async getCompanyById(companyId: string) {
    return this.company?.id === companyId ? this.company : null;
  }
  async exportCompany(_companyId: string): Promise<BackupPayload> {
    this.exportCalled += 1;
    return makePayload({}); // estado atual
  }
  async restoreCompany(companyId: string, backupData: BackupPayload): Promise<void> {
    this.restoreCalled += 1;
    this.restoredPayload = backupData;
    void companyId;
  }
}

class InMemoryStore implements BackupFileStore {
  written: { slug: string; payload: BackupPayload; filename: string }[] = [];

  writeAutoBackup(companySlug: string, payload: BackupPayload): string {
    const filename = buildAutoBackupFilename(companySlug, new Date('2026-08-09T10:00:00.000Z'));
    this.written.push({ slug: companySlug, payload, filename });
    return filename;
  }
  listAutoBackups(_companySlug: string): AutoBackupInfo[] {
    return [];
  }
  readAutoBackup(_companySlug: string, filename: string): string | null {
    return filename === 'backup-nairim-nairim-auto-2026-08-09T10-00-00.json'
      ? JSON.stringify(makePayload())
      : null;
  }
}

describe('Backup helpers (core/utils/backup-filename)', () => {
  it('buildChecksum é SHA-256 hex de JSON.stringify(data)', () => {
    const data = { a: 1, b: [2, 3] };
    const expected = require('node:crypto')
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
    expect(buildChecksum(data)).toBe(expected);
  });

  it('buildChecksum é determinístico e sensível ao conteúdo', () => {
    expect(buildChecksum({ a: 1 })).toBe(buildChecksum({ a: 1 }));
    expect(buildChecksum({ a: 1 })).not.toBe(buildChecksum({ a: 2 }));
  });

  it('toAutoBackupStamp remove ":" e ms (slice(0,19))', () => {
    expect(toAutoBackupStamp(new Date('2026-08-09T10:11:12.345Z'))).toBe('2026-08-09T10-11-12');
  });

  it('buildAutoBackupFilename segue o padrão do backend', () => {
    expect(buildAutoBackupFilename('nairim', new Date('2026-08-09T10:00:00.000Z'))).toBe(
      'backup-nairim-nairim-auto-2026-08-09T10-00-00.json',
    );
  });

  it('autoBackupPrefix filtra pelo slug', () => {
    expect(autoBackupPrefix('nairim')).toBe('backup-nairim-nairim-auto-');
  });
});

describe('RestoreBackupUseCase', () => {
  const buildRestore = () => {
    const repo = new InMemoryBackupRepo();
    const store = new InMemoryStore();
    return { useCase: new RestoreBackupUseCase(repo, store), repo, store };
  };

  it('restaura com sucesso: confirma pelo nome, cria auto-backup ANTES do restore', async () => {
    const { useCase, repo, store } = buildRestore();
    const backup = makePayload();

    const outcome: RestoreOutcome = await useCase.execute('c1', backup, 'nairim');

    // auto-backup gravado antes de restaurar
    expect(store.written.length).toBe(1);
    expect(store.written[0].filename).toContain('auto-');
    expect(repo.exportCalled).toBe(1);
    expect(repo.restoreCalled).toBe(1);
    expect(repo.restoredPayload).toBe(backup);

    expect(outcome.success).toBe(true);
    expect(outcome.company_name).toBe('Nairim');
    // 2 registros (properties + owners)
    expect(outcome.message).toContain('(2 registros)');
    expect(outcome.autoBackupName).toBe(store.written[0].filename);
  });

  it('aceita confirmação pelo slug (case-insensitive)', async () => {
    const { useCase, repo } = buildRestore();
    const outcome = await useCase.execute('c1', makePayload(), 'NAIRIM');
    expect(outcome.company_name).toBe('Nairim');
    expect(repo.restoreCalled).toBe(1);
  });

  it('rejeita confirmação inválida', async () => {
    const { useCase, repo } = buildRestore();
    await expect(useCase.execute('c1', makePayload(), 'errado')).rejects.toThrow(
      new ValidationError('Confirmação inválida. Digite exatamente "Nairim" ou "nairim" para prosseguir.'),
    );
    expect(repo.exportCalled).toBe(0);
    expect(repo.restoreCalled).toBe(0);
  });

  it('rejeita arquivo sem meta/data', async () => {
    const { useCase } = buildRestore();
    await expect(useCase.execute('c1', {} as BackupPayload, 'nairim')).rejects.toThrow(
      new ValidationError('Arquivo de backup inválido (estrutura esperada: meta + data)'),
    );
  });

  it('rejeita versão incompatível', async () => {
    const { useCase } = buildRestore();
    const backup = makePayload({});
    backup.meta = { ...backup.meta, formatVersion: 999 };
    await expect(useCase.execute('c1', backup, 'nairim')).rejects.toThrow(
      new ValidationError(`Versão do backup incompatível. Esperado: v${BACKUP_FORMAT_VERSION}, recebido: v999`),
    );
  });

  it('rejeita backup de outra empresa', async () => {
    const { useCase } = buildRestore();
    const backup = makePayload();
    backup.meta = { ...backup.meta, company_id: 'c2' };
    await expect(useCase.execute('c1', backup, 'nairim')).rejects.toThrow(
      new ValidationError('Backup não corresponde a esta empresa. ID no arquivo: c2, ID atual: c1'),
    );
  });

  it('rejeita checksum divergente (arquivo corrompido)', async () => {
    const { useCase } = buildRestore();
    const backup = makePayload();
    backup.meta = { ...backup.meta, checksum: '0'.repeat(64) };
    await expect(useCase.execute('c1', backup, 'nairim')).rejects.toThrow(
      new ValidationError('Checksum do backup não corresponde. Arquivo pode estar corrompido.'),
    );
  });

  it('empresa inexistente → NotFoundError', async () => {
    const { useCase } = buildRestore();
    await expect(useCase.execute('missing', makePayload(), 'nairim')).rejects.toThrow(
      new NotFoundError('Empresa não encontrada'),
    );
  });
});

describe('Outros use-cases de Backup', () => {
  it('ExportBackupUseCase delega e retorna o payload', async () => {
    const repo = new InMemoryBackupRepo();
    const payload = await new ExportBackupUseCase(repo).execute('c1');
    expect(payload.meta.company_id).toBe('c1');
    expect(repo.exportCalled).toBe(1);
  });

  it('ListAutoBackupsUseCase delega ao store', async () => {
    const store: BackupFileStore = {
      writeAutoBackup: () => '',
      listAutoBackups: vi.fn(() => [{ name: 'x.json', size: 1, createdAt: '2026-01-01' }]),
      readAutoBackup: vi.fn(() => null),
    };
    const result = new ListAutoBackupsUseCase(store).execute('nairim');
    expect(result[0].name).toBe('x.json');
    expect(vi.mocked(store.listAutoBackups)).toHaveBeenCalledWith('nairim');
  });

  it('DownloadAutoBackupUseCase devolve o conteúdo ou null', async () => {
    const store = new InMemoryStore();
    const ok = new DownloadAutoBackupUseCase(store).execute('nairim', 'backup-nairim-nairim-auto-2026-08-09T10-00-00.json');
    expect(ok?.name).toContain('auto-');
    expect(ok?.content).toContain('"formatVersion"');

    const missing = new DownloadAutoBackupUseCase(store).execute('nairim', 'outra-empresa.json');
    expect(missing).toBeNull();
  });
});