import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ repair: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  property: { findFirst: vi.fn() }, repairMedia: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), delete: vi.fn() }, $executeRaw: vi.fn() }));
const storage = vi.hoisted(() => ({ uploadMedia: vi.fn(), delete: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) } }));
vi.mock('@/infra/storage/minio-storage', () => ({ minioStorage: storage }));
import { PrismaRepairsRepository } from './prisma-repairs-repository';
const repo = new PrismaRepairsRepository();
describe('Repositório de reparos', () => {
  beforeEach(() => { vi.resetAllMocks(); storage.uploadMedia.mockResolvedValue({ url: 'https://storage/file', contentType: 'image/avif' }); });
  it('não altera ou exclui reparo ausente do contexto da empresa', async () => {
    db.repair.findFirst.mockResolvedValue(null);
    await expect(repo.remove('foreign')).rejects.toThrow('Reparo não encontrado');
    expect(db.repair.update).not.toHaveBeenCalled();
  });
  it('recusa uploads com tipo inválido antes de acessar o armazenamento', async () => {
    db.repair.findFirst.mockResolvedValue({ id: 'r' });
    await expect(repo.upload('company', 'r', 'BEFORE', new File(['x'],'bad.html',{type:'text/html'}))).rejects.toThrow('Envie uma imagem');
    expect(storage.uploadMedia).not.toHaveBeenCalled();
  });
  it('verifica a empresa novamente na transação e limpa o upload se o reparo não existir', async () => {
    db.repair.findFirst.mockResolvedValueOnce({ id: 'r' }).mockResolvedValueOnce(null);
    await expect(repo.upload('company', 'r', 'BEFORE', new File(['x'],'antes.png',{type:'image/png'}))).rejects.toThrow('Reparo não encontrado');
    expect(db.repair.findFirst).toHaveBeenLastCalledWith({ where: { id: 'r', company_id: 'company', deleted_at: null }, select: { id: true } });
    expect(storage.delete).toHaveBeenCalledWith('https://storage/file');
  });
  it('impede exceder o limite por etapa e remove o arquivo enviado', async () => {
    db.repair.findFirst.mockResolvedValue({ id: 'r' }); db.repairMedia.count.mockResolvedValue(10);
    await expect(repo.upload('company', 'r', 'AFTER', new File(['x'],'depois.png',{type:'image/png'}))).rejects.toThrow('Limite de 10');
    expect(db.repairMedia.create).not.toHaveBeenCalled(); expect(storage.delete).toHaveBeenCalled();
  });
  it('não exclui uma mídia vinculada a outro reparo', async () => {
    db.repair.findFirst.mockResolvedValue({ id: 'r' }); db.repairMedia.findFirst.mockResolvedValue(null);
    await expect(repo.removeMedia('r','foreign')).rejects.toThrow('Mídia não encontrada');
    expect(db.repairMedia.delete).not.toHaveBeenCalled(); expect(storage.delete).not.toHaveBeenCalled();
  });
});
