import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ repair: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  property: { findFirst: vi.fn() }, supplier: { findMany: vi.fn() }, repairProfessional: { deleteMany: vi.fn() }, repairItem: { deleteMany: vi.fn() }, repairMedia: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), delete: vi.fn() }, $executeRaw: vi.fn() }));
const storage = vi.hoisted(() => ({ uploadMedia: vi.fn(), delete: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) } }));
vi.mock('@/infra/storage/minio-storage', () => ({ minioStorage: storage }));
import { PrismaRepairsRepository } from './prisma-repairs-repository';
import { repairSchema } from '@/shared/validators/repair';
const repo = new PrismaRepairsRepository();
const input = repairSchema.parse({ property_id: '00000000-0000-4000-8000-000000000001', supplier_id: '00000000-0000-4000-8000-000000000002', event_date: '2026-10-02', event_type: 'REPAIR', problem_type: 'STRUCTURAL', description: 'Trincas', service_amount: 1200.50, materials_amount: 300.25, payment_method: 'Pix', payment_conditions: 'À vista', status: 'PLANNED' });
describe('Repositório de reparos', () => {
  beforeEach(() => { vi.resetAllMocks(); storage.uploadMedia.mockResolvedValue({ url: 'https://storage/file', contentType: 'image/avif' }); });
  it('recusa contatos de outra empresa, inativos ou excluídos antes de gravar', async () => {
    db.property.findFirst.mockResolvedValue({ id: input.property_id });
    db.supplier.findMany.mockResolvedValue([]);
    await expect(repo.save('company', null, input)).rejects.toThrow('contato ativo');
    expect(db.supplier.findMany).toHaveBeenCalledWith({ where: { id: { in: input.supplier_ids }, company_id: 'company', deleted_at: null, is_active: true }, select: { id: true, legal_name: true } });
    expect(db.repair.create).not.toHaveBeenCalled();
  });
  it('grava o ID e o nome do contato validado, mantendo os centavos', async () => {
    db.property.findFirst.mockResolvedValue({ id: input.property_id });
    db.supplier.findMany.mockResolvedValue([{ id: input.supplier_id, legal_name: 'José Gonçalves' }]);
    db.repair.create.mockImplementation(async ({ data }) => ({ ...data, id: 'r', items: [], professionals: [], supplier: { id: input.supplier_id, legal_name: 'José Gonçalves', trade_name: null }, media: [] }));
    const saved = await repo.save('company', null, input);
    expect(db.repair.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ supplier_id: input.supplier_id, professional: 'José Gonçalves', service_amount: 1200.50, materials_amount: 300.25, company_id: 'company' }) }));
    expect(saved).toMatchObject({ supplier_id: input.supplier_id, professional: 'José Gonçalves', supplier: { id: input.supplier_id } });
  });
  it('consulta o nome atual do contato e preserva o nome histórico sem vínculo', async () => {
    const row = { id: 'r', professional: 'Nome antigo', supplier_id: input.supplier_id, event_date: new Date('2026-10-02'), service_amount: 10, materials_amount: 5, media: [] };
    db.repair.findMany.mockResolvedValue([{ ...row, supplier: { id: input.supplier_id, legal_name: 'Nome atualizado', trade_name: null } }, { ...row, id: 'old', supplier_id: null, supplier: null }]);
    db.repair.count.mockResolvedValue(2);
    const result = await repo.list({ page: 1 });
    expect(result.data.map(r => r.professional)).toEqual(['Nome atualizado', 'Nome antigo']);
  });
  it('salva vários problemas e responsáveis e calcula subtotais pelos itens, ignorando totais adulterados', async () => {
    const secondId = '00000000-0000-4000-8000-000000000003';
    const multiple = repairSchema.parse({ ...input, problem_types: ['HYDRAULIC', 'FINISHING'], supplier_ids: [input.supplier_id, secondId],
      service_amount: 999, materials_amount: 999, items: [
        { description: 'Trocar duas janelas', kind: 'LABOR', supplier_id: input.supplier_id, amount: 1500 },
        { description: 'Duas janelas de alumínio', kind: 'MATERIAL', supplier_id: secondId, amount: 5000 },
        { description: 'Acabamento', kind: 'LABOR', supplier_id: input.supplier_id, amount: 0.10 },
        { description: 'Ajustes', kind: 'LABOR', supplier_id: input.supplier_id, amount: 0.20 },
      ] });
    db.property.findFirst.mockResolvedValue({ id: input.property_id });
    db.supplier.findMany.mockResolvedValue([{ id: input.supplier_id, legal_name: 'Agnaldo da Silva' }, { id: secondId, legal_name: 'MultLeve' }]);
    db.repair.create.mockImplementation(async ({ data }) => ({ ...data, id: 'r', professionals: data.professionals.create.map((p: {supplier_id: string}) => ({ ...p, supplier: { id: p.supplier_id, legal_name: p.supplier_id === secondId ? 'MultLeve' : 'Agnaldo da Silva' } })), items: data.items.create, media: [] }));
    const saved = await repo.save('company', null, multiple);
    expect(saved).toMatchObject({ problem_types: ['HYDRAULIC', 'FINISHING'], professional: 'Agnaldo da Silva, MultLeve', service_amount: 1500.30, materials_amount: 5000 });
    expect(saved.items).toHaveLength(4);
    expect(saved.professionals).toHaveLength(2);
  });
  it('recusa um contato de item que não pertence à empresa, mesmo com responsáveis válidos', async () => {
    db.property.findFirst.mockResolvedValue({ id: input.property_id });
    db.supplier.findMany.mockResolvedValue([{ id: input.supplier_id, legal_name: 'José' }]);
    const multiple = repairSchema.parse({ ...input, items: [{ description: 'Janelas', kind: 'MATERIAL', amount: 5000, supplier_id: '00000000-0000-4000-8000-000000000003' }] });
    await expect(repo.save('company', null, multiple)).rejects.toThrow('contato ativo');
    expect(db.repair.create).not.toHaveBeenCalled();
  });
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
