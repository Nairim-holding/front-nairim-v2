import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.hoisted(() => vi.fn());
vi.mock('@/infra/database/prisma', () => ({ default: { property: { findMany } } }));
vi.mock('../property-occupancy', () => ({ releaseExpiredProperties: vi.fn() }));
import { PrismaDashboardRepository } from '../prisma-dashboard-repository';

const property = (id: string, documents: { type: string; deleted_at?: Date | null }[] = []) => ({
  id, title: id, area_total: 100, type: { description: 'Casa' },
  values: [{ status: 'AVAILABLE', rental_value: 1000 }], documents, leases: [], agency: null,
});

describe('imóveis sem documentos de matrícula, registro ou escritura', () => {
  beforeEach(() => vi.resetAllMocks());

  it('exclui o imóvel assim que qualquer um dos três anexos está presente', async () => {
    findMany.mockResolvedValueOnce([
      property('empty'), property('photo-only', [{ type: 'IMAGE' }]), property('other-only', [{ type: 'OTHER' }]),
      property('registration', [{ type: 'REGISTRATION' }]), property('record', [{ type: 'PROPERTY_RECORD' }]),
      property('deed', [{ type: 'TITLE_DEED' }]),
      property('all', [{ type: 'REGISTRATION' }, { type: 'PROPERTY_RECORD' }, { type: 'TITLE_DEED' }]),
    ]).mockResolvedValueOnce([]);
    const result = await new PrismaDashboardRepository().getPortfolio(new Date('2026-09-01'), new Date('2026-09-30'));
    expect(result.countPropertiesWithLessThan3Docs.result).toBe(3);
    expect(result.countPropertiesWithLessThan3Docs.data).toEqual([
      expect.objectContaining({ id: 'empty', documentCount: 0, isComplete: false }),
      expect.objectContaining({ id: 'photo-only', documentCount: 0, isComplete: false }),
      expect.objectContaining({ id: 'other-only', documentCount: 0, isComplete: false }),
    ]);
  });

  it('não considera documentos excluídos e aplica a mesma regra ao período anterior', async () => {
    findMany.mockResolvedValueOnce([
      property('deleted-document', [{ type: 'REGISTRATION', deleted_at: new Date('2026-09-01') }]),
      property('has-deed', [{ type: 'TITLE_DEED', deleted_at: null }]),
    ]).mockResolvedValueOnce([
      property('previous-empty'), property('previous-photo', [{ type: 'IMAGE' }]),
      property('previous-record', [{ type: 'PROPERTY_RECORD' }]),
    ]);
    const result = await new PrismaDashboardRepository().getPortfolio(new Date('2026-09-01'), new Date('2026-09-30'));
    expect(result.countPropertiesWithLessThan3Docs).toMatchObject({ result: 1, variation: -50 });
    expect(result.countPropertiesWithLessThan3Docs.data).toEqual([expect.objectContaining({ id: 'deleted-document' })]);
    expect(findMany.mock.calls[0][0].include.documents.where).toEqual({ deleted_at: null });
    expect(findMany.mock.calls[1][0].include.documents.where).toEqual({ deleted_at: null });
  });
});
