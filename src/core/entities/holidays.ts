export type HolidayScope = 'NATIONAL' | 'STATE' | 'MUNICIPAL';
export interface AutomaticHoliday {
  date: string;
  description: string;
  scope: HolidayScope;
  city: string | null;
  state: string | null;
}

export const normalizeLocality = (value?: string | null) =>
  (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

export const BRAZIL_STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

/** Gregorian Easter, used to calculate Good Friday for each selected year. */
function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return new Date(Date.UTC(year, Math.floor(n / 31) - 1, n % 31 + 1));
}

// Sources (verified September 2026):
// https://www.gov.br/gestao/pt-br/assuntos/noticias/2025/dezembro/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026
// https://www.al.sp.gov.br/repositorio/legislacao/lei/1997/compilacao-lei-9497-05.03.1997.html
// https://www.garca.sp.gov.br/portal/noticias/0/3/10356/feriados-de-maio-informacoes-e-programacao-oficial-da-prefeitura-de-garca/
// Garça Law 3.373/1999 also appears in TRT-15's 2026 municipal calendar.
// Optional government office closures are not included as public holidays.
export function automaticHolidays(year: number, state?: string | null, city?: string | null): AutomaticHoliday[] {
  const fixed: Array<[string, string]> = [
    ['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'], ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'], ['12-25', 'Natal'],
  ];
  if (year >= 2024) fixed.push(['11-20', 'Dia Nacional de Zumbi e da Consciência Negra']);
  const result: AutomaticHoliday[] = fixed.map(([date, description]) => ({ date: `${year}-${date}`, description, scope: 'NATIONAL', city: null, state: null }));
  const friday = easter(year);
  friday.setUTCDate(friday.getUTCDate() - 2);
  result.push({ date: friday.toISOString().slice(0, 10), description: 'Paixão de Cristo', scope: 'NATIONAL', city: null, state: null });
  if (normalizeLocality(state) === 'SP') {
    result.push({ date: `${year}-07-09`, description: 'Revolução Constitucionalista', scope: 'STATE', state: 'SP', city: null });
    if (normalizeLocality(city) === 'GARCA') {
      result.push({ date: `${year}-05-05`, description: 'Aniversário de Garça', scope: 'MUNICIPAL', state: 'SP', city: 'Garça' });
      result.push({ date: `${year}-06-29`, description: 'São Pedro', scope: 'MUNICIPAL', state: 'SP', city: 'Garça' });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export function holidayWeekday(date: string): string {
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
