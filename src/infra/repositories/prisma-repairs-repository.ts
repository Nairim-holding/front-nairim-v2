import prisma from '@/infra/database/prisma';
import { minioStorage } from '@/infra/storage/minio-storage';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';
import type { Repair } from '@/core/entities/repair';
import { repairListSchema, REPAIR_MEDIA_TYPES, REPAIR_MEDIA_MAX_BYTES, type RepairInput } from '@/shared/validators/repair';
import type { z } from 'zod';

const include = { property: { select: { id: true, title: true } }, supplier: { select: { id: true, legal_name: true, trade_name: true } },
  professionals: { include: { supplier: { select: { id: true, legal_name: true } } }, orderBy: { id: 'asc' as const } },
  items: { include: { supplier: { select: { legal_name: true } } }, orderBy: { position: 'asc' as const } },
  media: { orderBy: { created_at: 'asc' as const } } };
function serialize(row: Awaited<ReturnType<typeof getRow>>): Repair {
  const professionals = row.professionals?.length ? row.professionals : row.supplier ? [{ supplier_id: row.supplier.id, supplier: row.supplier }] : [];
  return { ...row, problem_types: row.problem_types?.length ? row.problem_types : [row.problem_type], professionals,
    items: (row.items ?? []).map(item => ({ ...item, amount: Number(item.amount), professional: item.supplier?.legal_name ?? item.professional })),
    supplier_id: row.supplier_id ?? null, supplier: row.supplier ?? null, professional: professionals.length ? professionals.map(p => p.supplier.legal_name).join(', ') : row.professional,
    service_amount: Number(row.service_amount), materials_amount: Number(row.materials_amount),
    event_date: row.event_date.toISOString().slice(0, 10), start_date: row.start_date?.toISOString().slice(0, 10) ?? null,
    completion_date: row.completion_date?.toISOString().slice(0, 10) ?? null } as Repair;
}
async function getRow(id: string) {
  const row = await prisma.repair.findFirst({ where: { id, deleted_at: null }, include });
  if (!row) throw new NotFoundError('Reparo não encontrado');
  return row;
}
export class PrismaRepairsRepository {
  async list(query: z.infer<typeof repairListSchema>) {
    const where = { deleted_at: null, property_id: query.property_id, status: query.status,
      ...(query.from || query.to ? { event_date: { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } } : {}),
      ...(query.search ? { OR: [ { description: { contains: query.search, mode: 'insensitive' as const } },
        { professional: { contains: query.search, mode: 'insensitive' as const } },
        { supplier: { legal_name: { contains: query.search, mode: 'insensitive' as const } } },
        { supplier: { trade_name: { contains: query.search, mode: 'insensitive' as const } } },
        { professionals: { some: { supplier: { legal_name: { contains: query.search, mode: 'insensitive' as const } } } } },
        { items: { some: { description: { contains: query.search, mode: 'insensitive' as const } } } },
        { property: { title: { contains: query.search, mode: 'insensitive' as const } } } ] } : {}) };
    const [rows, count] = await Promise.all([
      prisma.repair.findMany({ where, include, orderBy: [{ event_date: 'desc' }, { id: 'asc' }], take: 25, skip: (query.page - 1) * 25 }),
      prisma.repair.count({ where }),
    ]);
    return { data: rows.map(serialize), count, totalPages: Math.ceil(count / 25) };
  }
  async properties() {
    return prisma.property.findMany({ where: { deleted_at: null }, select: { id: true, title: true }, orderBy: { title: 'asc' } });
  }
  async save(companyId: string, id: string | null, input: RepairInput) {
    if (id) await getRow(id);
    const { supplier_ids, items, ...fields } = input;
    const supplierIds = [...new Set([...supplier_ids, ...items.map(item => item.supplier_id)])];
    const [property, suppliers] = await Promise.all([
      prisma.property.findFirst({ where: { id: input.property_id, company_id: companyId, deleted_at: null }, select: { id: true } }),
      prisma.supplier.findMany({ where: { id: { in: supplierIds }, company_id: companyId, deleted_at: null, is_active: true }, select: { id: true, legal_name: true } }),
    ]);
    if (!property) throw new ValidationError('Escolha um imóvel ativo da empresa');
    if (suppliers.length !== supplierIds.length) throw new ValidationError('Escolha um contato ativo do Financeiro da própria empresa para todos os responsáveis e itens');
    const names = new Map(suppliers.map(s => [s.id, s.legal_name]));
    const cents = (kind: string) => items.filter(item => item.kind === kind).reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
    const data = { ...fields, problem_type: input.problem_types[0], supplier_id: supplierIds[0], professional: supplierIds.map(s => names.get(s)).join(', '),
      service_amount: items.length ? cents('LABOR') : input.service_amount, materials_amount: items.length ? cents('MATERIAL') : input.materials_amount,
      event_date: new Date(input.event_date), start_date: input.start_date ? new Date(input.start_date) : null,
      completion_date: input.completion_date ? new Date(input.completion_date) : null };
    const row = await prisma.$transaction(async tx => {
      if (id) {
        await tx.repairProfessional.deleteMany({ where: { repair_id: id, company_id: companyId } });
        await tx.repairItem.deleteMany({ where: { repair_id: id, company_id: companyId } });
      }
      const nested = {
        professionals: { create: supplierIds.map(supplier_id => ({ company_id: companyId, supplier_id })) },
        items: { create: items.map((item, position) => ({ ...item, company_id: companyId, position, professional: names.get(item.supplier_id)! })) },
      };
      return id ? tx.repair.update({ where: { id, company_id: companyId }, data: { ...data, ...nested }, include })
        : tx.repair.create({ data: { ...data, ...nested, company_id: companyId }, include });
    });
    return serialize(row);
  }
  async remove(id: string) {
    await getRow(id);
    await prisma.repair.update({ where: { id }, data: { deleted_at: new Date() } });
  }
  async upload(companyId: string, id: string, stage: 'BEFORE' | 'AFTER', file: File) {
    await getRow(id);
    if (!REPAIR_MEDIA_TYPES.includes(file.type) || !file.size || file.size > REPAIR_MEDIA_MAX_BYTES)
      throw new ValidationError('Envie uma imagem JPG, PNG, WebP, AVIF ou vídeo MP4/WebM de até 20 MB');
    const media = await minioStorage.uploadMedia({ buffer: Buffer.from(await file.arrayBuffer()), filename: file.name, contentType: file.type, size: file.size }, `companies/${companyId}/repairs/${id}`);
    try {
      return await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const repair = await tx.repair.findFirst({ where: { id, company_id: companyId, deleted_at: null }, select: { id: true } });
        if (!repair) throw new NotFoundError('Reparo não encontrado');
        const count = await tx.repairMedia.count({ where: { repair_id: id, company_id: companyId, stage } });
        if (count >= 10) throw new ValidationError('Limite de 10 mídias em cada etapa');
        return tx.repairMedia.create({ data: { company_id: companyId, repair_id: id, stage, filename: file.name, url: media.url, content_type: media.contentType } });
      });
    } catch (error) { await minioStorage.delete(media.url); throw error; }
  }
  async removeMedia(id: string, mediaId: string) {
    await getRow(id);
    const media = await prisma.repairMedia.findFirst({ where: { id: mediaId, repair_id: id } });
    if (!media) throw new NotFoundError('Mídia não encontrada');
    await prisma.repairMedia.delete({ where: { id: mediaId } });
    await minioStorage.delete(media.url);
  }
}
export const repairsRepository = new PrismaRepairsRepository();
