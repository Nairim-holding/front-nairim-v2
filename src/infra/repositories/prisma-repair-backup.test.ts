import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ delegates: new Map<string, Record<string, ReturnType<typeof vi.fn>>>() }));
vi.mock('@/infra/database/prisma', () => {
  const client = new Proxy({}, { get(_target, key) {
    if (key === '$transaction') return async (callback: (tx: object) => unknown) => callback(client);
    if (!state.delegates.has(String(key))) state.delegates.set(String(key), Object.fromEntries(
      ['findMany','findUnique','deleteMany','create','createMany','count','update','upsert'].map(method => [method, vi.fn().mockResolvedValue(method === 'findMany' ? [] : undefined)]),
    ));
    return state.delegates.get(String(key));
  } });
  return { default: client };
});
import prisma from '@/infra/database/prisma';
import { PrismaBackupRepository } from './prisma-backup-repository';
import type { BackupPayload } from '@/core/entities/backup';
import { runWithAuditActor } from '@/infra/database/audit-context';
const repository = new PrismaBackupRepository();
const repo = {
  exportCompany: (...args: Parameters<typeof repository.exportCompany>) => repository.exportCompany(...args),
  restoreCompany: (...args: Parameters<typeof repository.restoreCompany>) => runWithAuditActor(
    { id: 'actor', name: 'Usuário', email: 'actor@example.test', company_id: args[0] },
    () => repository.restoreCompany(...args),
  ),
};
const payload = (data: BackupPayload['data']) => ({ data } as BackupPayload);
describe('Reparos no backup da empresa', () => {
  beforeEach(() => state.delegates.clear());
  it('exporta reparos e mídias com o escopo da empresa e contagens', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id:'a',name:'Empresa',slug:'empresa' } as never);
    vi.mocked(prisma.repair.findMany).mockResolvedValue([{ id:'r',company_id:'a' }] as never);
    vi.mocked(prisma.repairMedia.findMany).mockResolvedValue([{ id:'m',company_id:'a',repair_id:'r' }] as never);
    const backup = await repo.exportCompany('a');
    expect(backup.data.repairs).toHaveLength(1); expect(backup.data.repairMedia).toHaveLength(1);
    expect(backup.meta.counts).toMatchObject({ repairs:1,repairMedia:1 });
    expect(prisma.repair.findMany).toHaveBeenCalledWith({ where:{company_id:'a'} });
  });
  it('recusa restauração que liga reparos a imóveis de outra empresa', async () => {
    vi.mocked(prisma.property.count).mockResolvedValue(0);
    await expect(repo.restoreCompany('a',payload({repairs:[{id:'r',company_id:'a',property_id:'foreign'}]}))).rejects.toThrow('imóveis de outra empresa');
    expect(prisma.repair.createMany).not.toHaveBeenCalled();
  });
  it('recusa restauração que liga mídias a reparos de outra empresa', async () => {
    vi.mocked(prisma.repair.count).mockResolvedValue(0);
    await expect(repo.restoreCompany('a',payload({repairMedia:[{id:'m',repair_id:'foreign'}]}))).rejects.toThrow('reparos de outra empresa');
    expect(prisma.repairMedia.createMany).not.toHaveBeenCalled();
  });
  it('recusa reparos vinculados a contatos de outra empresa ou ausentes do backup', async () => {
    vi.mocked(prisma.property.count).mockResolvedValue(1);
    vi.mocked(prisma.supplier.count).mockResolvedValue(0);
    await expect(repo.restoreCompany('a', payload({ repairs: [{ id: 'r', property_id: 'p', supplier_id: 'foreign' }] }))).rejects.toThrow('contatos de outra empresa');
    expect(prisma.repair.createMany).not.toHaveBeenCalled();
  });
  it('restaura o vínculo com contatos já restaurados da própria empresa', async () => {
    vi.mocked(prisma.property.count).mockResolvedValue(1);
    vi.mocked(prisma.supplier.count).mockResolvedValue(1);
    await repo.restoreCompany('a', payload({ suppliers: [{ id: 's', company_id: 'a' }], repairs: [{ id: 'r', company_id: 'a', property_id: 'p', supplier_id: 's' }] }));
    expect(prisma.supplier.count).toHaveBeenCalledWith({ where: { company_id: 'a', id: { in: ['s'] } } });
    expect(vi.mocked(prisma.supplier.createMany).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(prisma.repair.createMany).mock.invocationCallOrder[0]);
  });
  it('restaura pais antes das mídias e impõe a empresa atual nos registros', async () => {
    vi.mocked(prisma.property.count).mockResolvedValue(1); vi.mocked(prisma.repair.count).mockResolvedValue(1);
    await repo.restoreCompany('a',payload({repairs:[{id:'r',company_id:'b',property_id:'p'}],repairMedia:[{id:'m',company_id:'b',repair_id:'r'}]}));
    expect(prisma.repair.createMany).toHaveBeenCalledWith({ data:[{id:'r',company_id:'a',property_id:'p'}] });
    expect(prisma.repairMedia.createMany).toHaveBeenCalledWith({ data:[{id:'m',company_id:'a',repair_id:'r'}] });
    expect(vi.mocked(prisma.repair.createMany).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(prisma.repairMedia.createMany).mock.invocationCallOrder[0]);
  });
});
