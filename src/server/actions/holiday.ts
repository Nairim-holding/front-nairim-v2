'use server';

import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { NotFoundError } from '@/core/errors/domain-errors';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { createHolidaySchema, listHolidaysSchema } from '@/shared/validators/holiday';
import { createDateLocal } from '@/shared/utils/date-utils';
import { automaticHolidays, type HolidayScope } from '@/core/entities/holidays';

export interface HolidayItem {
  id: string;
  date: string;
  description: string;
  scope: HolidayScope;
  city: string | null;
  state: string | null;
  automatic?: boolean;
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
      const properties = await prisma.property.findMany({
        where: { company_id: session.company_id, deleted_at: null },
        select: { addresses: { where: { deleted_at: null }, select: { address: { select: { city: true, state: true } } } } },
      });
      const automatic = new Map<string, HolidayItem>();
      const localities = [{ city: null, state: null }, ...properties.flatMap((property) => property.addresses.map((entry) => entry.address))];
      for (const locality of localities) {
        for (const holiday of automaticHolidays(year, locality.state, locality.city)) {
          const id = `automatic:${holiday.date}:${holiday.scope}:${holiday.state ?? ''}:${holiday.city ?? ''}`;
          automatic.set(id, { ...holiday, id, automatic: true });
        }
      }
      const saved = rows.map((row) => ({
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        description: row.description,
        scope: row.scope,
        city: row.city,
        state: row.state,
      }));
      const automaticRows = [...automatic.values()].filter((holiday) => !saved.some((row) => row.date === holiday.date && row.scope === holiday.scope && row.city === holiday.city && row.state === holiday.state));
      return [...saved, ...automaticRows].sort((a, b) => a.date.localeCompare(b.date));
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
          state: input.scope !== 'NATIONAL' ? input.state : null,
        },
      });
      return {
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        description: row.description,
        scope: row.scope,
        city: row.city,
        state: row.state,
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
