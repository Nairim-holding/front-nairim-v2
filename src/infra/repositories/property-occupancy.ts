import type { Prisma } from '@/generated/prisma/client';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';

/** Contratos DATE-only continuam válidos durante todo o último dia em São Paulo. */
export function occupancyDate(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
}

type Client = Pick<typeof import('@/infra/database/prisma').default, 'property' | 'propertyValue' | 'lease'>;

export async function syncPropertyOccupancy(client: Client, propertyId: string): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;
  const property = await client.property.findFirst({ where: { id: propertyId, company_id: companyId, deleted_at: null }, select: { id: true } });
  if (!property) return;
  const latest = await client.propertyValue.findFirst({ where: { property_id: propertyId, deleted_at: null }, orderBy: { created_at: 'desc' } });
  if (!latest || !['AVAILABLE', 'OCCUPIED'].includes(latest.status)) return;
  const active = await client.lease.count({ where: { property_id: propertyId, company_id: companyId, deleted_at: null, status: { not: 'CANCELED' }, end_date: { gte: occupancyDate() } } });
  const status = active > 0 ? 'OCCUPIED' : 'AVAILABLE';
  if (latest.status !== status) await client.propertyValue.update({ where: { id: latest.id }, data: { status } });
}

/** Reconcilia vencimentos na consulta, sem depender de editar novamente a locação. */
export async function releaseExpiredProperties(client: Client): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;
  const today = occupancyDate();
  const propertyWhere: Prisma.PropertyWhereInput = {
    company_id: companyId, deleted_at: null,
    AND: [
      { leases: { some: { deleted_at: null, status: { not: 'CANCELED' }, end_date: { lt: today } } } },
      { leases: { none: { deleted_at: null, status: { not: 'CANCELED' }, end_date: { gte: today } } } },
    ],
  };
  const properties = await client.property.findMany({
    where: propertyWhere,
    select: { values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1, select: { id: true, status: true } } },
  });
  const ids = properties.flatMap(p => p.values.filter(v => v.status === 'OCCUPIED').map(v => v.id));
  if (ids.length) await client.propertyValue.updateMany({
    where: { id: { in: ids }, status: 'OCCUPIED', property: propertyWhere }, data: { status: 'AVAILABLE' },
  });
}
