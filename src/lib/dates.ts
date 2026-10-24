/** Dates are plain local YYYY-MM-DD strings; times are HH:MM. No timezone math. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

export function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function weekday(s: string): number {
  return fromISO(s).getDay();
}

/** first day of the week containing `s` */
export function startOfWeek(s: string, weekStart: 0 | 1): string {
  const diff = (weekday(s) - weekStart + 7) % 7;
  return addDays(s, -diff);
}

export function weekDates(s: string, weekStart: 0 | 1): string[] {
  const first = startOfWeek(s, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function isISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISO(fromISO(s)) === s;
}

export function isTime(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(m: number): string {
  const c = Math.max(0, Math.min(23 * 60 + 59, Math.round(m)));
  return `${pad(Math.floor(c / 60))}:${pad(c % 60)}`;
}

export function fmtTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m)} ${ap}`;
}

export function fmtDuration(min?: number): string {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function fmtLong(s: string): string {
  return fromISO(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function fmtShort(s: string): string {
  return fromISO(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
