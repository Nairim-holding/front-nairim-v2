import { describe, expect, it } from 'vitest';
import { isWithinAccessSchedule } from './access-schedule';

describe('server-side access hours', () => {
  const schedules = [{ day_of_week: 1, start_time: new Date('1970-01-01T08:00:00Z'), end_time: new Date('1970-01-01T18:00:00Z') }];
  it('uses São Paulo local time and includes the start boundary', () => {
    expect(isWithinAccessSchedule(schedules, new Date('2026-09-07T11:00:00Z'))).toBe(true);
    expect(isWithinAccessSchedule(schedules, new Date('2026-09-07T10:59:00Z'))).toBe(false);
  });
  it('excludes the end boundary, other days and empty schedules', () => {
    expect(isWithinAccessSchedule(schedules, new Date('2026-09-07T21:00:00Z'))).toBe(false);
    expect(isWithinAccessSchedule(schedules, new Date('2026-09-08T15:00:00Z'))).toBe(false);
    expect(isWithinAccessSchedule([], new Date('2026-09-07T15:00:00Z'))).toBe(false);
  });
});
