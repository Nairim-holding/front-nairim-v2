'use server';

import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { NotFoundError } from '@/core/errors/domain-errors';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { createHolidaySchema, listHolidaysSchema } from '@/shared/validators/holiday';
import { createDateLocal } from '@/shared/utils/date-utils';

export interface HolidayItem {
  id: string;
  date: string;
  description: string;
  scope: 'NATIONAL' | 'MUNICIPAL';
  city: string | null;
}

export async function listHolidaysAction(raw: Record<string, unknown>): Promise<ActionResult<HolidayItem[]>> {
  return runAction(async () => {
    const { year } = listHolidaysSchema.parse(raw);
    return withPermission('financial-transactions', 'view', async (session) => {
      const rows = await prisma.holiday.findMany({
        where: {
          company_id: session.company_id,
          deleted_at: null,
          date: { gte: createDateLocal(year, 1, 1), lte: createDateLocal(year, 12, 31) },
        },
        orderBy: { date: 'asc' },
      });
      return rows.map((row) => ({
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        description: row.description,
        scope: row.scope,
        city: row.city,
      }));
    });
  });
}

export async function createHolidayAction(raw: Record<string, unknown>): Promise<ActionResult<HolidayItem>> {
  return runAction(async () => {
    const input = createHolidaySchema.parse(raw);
    return withPermission('financial-transactions', 'edit', async (session) => {
      const [year, month, day] = input.date.split('-').map(Number);
      const row = await prisma.holiday.create({
        data: {
          company_id: session.company_id,
          date: createDateLocal(year, month, day),
          description: input.description,
          scope: input.scope,
          city: input.scope === 'MUNICIPAL' ? input.city : null,
        },
      });
      return {
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        description: row.description,
        scope: row.scope,
        city: row.city,
      };
    });
  });
}

export async function deleteHolidayAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => withPermission('financial-transactions', 'edit', async (session) => {
    const result = await prisma.holiday.updateMany({
      where: { id, company_id: session.company_id, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    if (result.count === 0) throw new NotFoundError('Feriado não encontrado.');
    return null;
  }));
}
