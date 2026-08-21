/**
 * Non-delivery days for the ateliê (based in São Paulo): Sundays, plus
 * national + São Paulo state + São Paulo city holidays. Used to compute
 * which delivery dates are actually offered at checkout and to validate
 * the date the client submits (never trust a client-picked date without
 * recomputing server-side — same reasoning as the shipping fee).
 *
 * Movable holidays (Carnaval, Sexta-feira Santa, Corpus Christi) are
 * computed from the date of Easter via the standard Anonymous Gregorian
 * algorithm, so this list is correct for any year without needing a
 * manual update. Carnaval and Corpus Christi are technically "pontos
 * facultativos" rather than statutory holidays, but in practice
 * deliveries don't run in São Paulo on those days, so they're treated as
 * non-delivery days here too — easy to remove if that assumption doesn't
 * match how the ateliê actually operates.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toISODate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Date of Easter Sunday for a given year (Anonymous Gregorian / Meeus-Jones-Butcher algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

// [month, day] — national, São Paulo state, and São Paulo city fixed-date holidays.
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1], // Confraternização Universal
  [1, 25], // Aniversário da cidade de São Paulo
  [4, 21], // Tiradentes
  [5, 1], // Dia do Trabalho
  [7, 9], // Revolução Constitucionalista de 1932 (SP)
  [9, 7], // Independência do Brasil
  [10, 12], // Nossa Senhora Aparecida
  [11, 2], // Finados
  [11, 15], // Proclamação da República
  [11, 20], // Dia Nacional de Zumbi e da Consciência Negra
  [12, 25], // Natal
];

function holidaysForYear(year: number): Set<string> {
  const dates = new Set<string>();
  for (const [month, day] of FIXED_HOLIDAYS) {
    dates.add(`${year}-${pad2(month)}-${pad2(day)}`);
  }
  const easter = easterSunday(year);
  dates.add(toISODate(addDays(easter, -48))); // Carnaval (segunda)
  dates.add(toISODate(addDays(easter, -47))); // Carnaval (terça)
  dates.add(toISODate(addDays(easter, -2))); // Sexta-feira Santa
  dates.add(toISODate(addDays(easter, 60))); // Corpus Christi
  return dates;
}

const holidayCache = new Map<number, Set<string>>();

function isHoliday(dateISO: string): boolean {
  const year = Number(dateISO.slice(0, 4));
  let set = holidayCache.get(year);
  if (!set) {
    set = holidaysForYear(year);
    holidayCache.set(year, set);
  }
  return set.has(dateISO);
}

function isSunday(dateISO: string): boolean {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

export function isDeliverableDay(dateISO: string): boolean {
  return !isSunday(dateISO) && !isHoliday(dateISO);
}

/**
 * Deliverable dates starting `minLeadDays` after `fromISO`, within a
 * `windowDays`-calendar-day window — e.g. minLeadDays=1, windowDays=7
 * gives "starting tomorrow, up to 7 days out", skipping Sundays/holidays
 * (so the result can have fewer than windowDays entries).
 */
export function upcomingDeliverableDates(fromISO: string, minLeadDays: number, windowDays: number): string[] {
  const [y, m, d] = fromISO.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];
  for (let offset = minLeadDays; offset < minLeadDays + windowDays; offset++) {
    const candidate = toISODate(addDays(base, offset));
    if (isDeliverableDay(candidate)) dates.push(candidate);
  }
  return dates;
}

/**
 * Today as 'YYYY-MM-DD', in the ateliê's own timezone (America/Sao_Paulo)
 * — NOT `new Date().toISOString().slice(0, 10)`, which renders in UTC.
 * Brazil is UTC-3, so anywhere from 21:00 to 23:59 local time, the UTC
 * calendar date is already tomorrow — that made every "earliest delivery
 * date" offered during those evening hours land one full day later than
 * intended (e.g. checking out at 21:30 on the 20th offered the 22nd as the
 * earliest date instead of the 21st). This is the single source of "today"
 * for delivery-date purposes; use it instead of the raw UTC one-liner
 * anywhere a calendar date (not an instant) is what's actually meant.
 */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
