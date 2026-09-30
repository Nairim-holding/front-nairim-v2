import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateUnifiedPropertyData } from '@/core/entities/property';

const db = vi.hoisted(() => ({
  property: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
  propertyValue: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
}));
vi.mock('@/infra/database/prisma', () => ({ default: { ...db, $transaction: async (work: (tx: typeof db) => unknown) => work(db) } }));
vi.mock('../property-occupancy', () => ({ releaseExpiredProperties: vi.fn() }));
import { PrismaPropertiesRepository } from '../prisma-properties-repository';

const data: CreateUnifiedPropertyData = {
  title: 'Casa', bedrooms: 2, bathrooms: 1, area_total: 100, furnished: false,
  tax_registration: '123', owner_id: 'owner', type_id: 'type',
  values: { status: 'SOLD', sale_buyer: 'Comprador', sale_date: '2026-09-28', sale_value: 450000,
    notes: 'Condições financeiras', sale_notes: 'Escritura em andamento.\nDocumentação entregue.' },
};

beforeEach(() => {
  vi.resetAllMocks();
  db.property.create.mockResolvedValue({ id: 'property' });
  db.property.update.mockResolvedValue({ id: 'property' });
  db.property.findUnique.mockResolvedValue({ id: 'property' });
  db.property.findFirst.mockResolvedValue({ id: 'property', values: [data.values] });
  db.propertyValue.findFirst.mockResolvedValue({ id: 'values' });
});

describe('property sale observation persistence', () => {
  it('writes the observation when creating a property and returns it on read', async () => {
    const saved = await new PrismaPropertiesRepository().create(data);
    expect(db.propertyValue.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      property_id: 'property', sale_notes: data.values?.sale_notes, notes: 'Condições financeiras',
    }) });
    expect(saved.values?.[0]).toMatchObject({ sale_notes: data.values?.sale_notes });
  });

  it('writes and clears the observation when editing an existing property', async () => {
    const repo = new PrismaPropertiesRepository();
    await repo.update('property', data);
    expect(db.propertyValue.update).toHaveBeenLastCalledWith({ where: { id: 'values' },
      data: expect.objectContaining({ sale_notes: data.values?.sale_notes }) });
    await repo.update('property', { ...data, values: { ...data.values!, sale_notes: null } });
    expect(db.propertyValue.update).toHaveBeenLastCalledWith({ where: { id: 'values' },
      data: expect.objectContaining({ sale_notes: null }) });
  });
});
