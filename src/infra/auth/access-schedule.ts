interface AccessInterval {
  day_of_week: number;
  start_time: Date;
  end_time: Date;
}

/** Schedules store wall-clock times in PostgreSQL Time; evaluate in São Paulo. */
export function isWithinAccessSchedule(schedules: AccessInterval[], now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minute = Number(get('hour')) * 60 + Number(get('minute'));
  return schedules.some((interval) => {
    const start = interval.start_time.getUTCHours() * 60 + interval.start_time.getUTCMinutes();
    const end = interval.end_time.getUTCHours() * 60 + interval.end_time.getUTCMinutes();
    return interval.day_of_week === day && minute >= start && minute < end;
  });
}
