import { addDays, toMinutes } from './dates';
import { itemsOn } from './schedule';
import type { Task } from './types';

const esc = (s: string) =>
  s
    .split('\\').join('\\\\')
    .split(';').join('\\;')
    .split(',').join('\\,')
    .split(/\r?\n/).join('\\n');
const d8 = (iso: string) => iso.split('-').join('');
const t6 = (hhmm: string) => hhmm.replace(':', '') + '00';
const hhmm = (min: number) => {
  const c = Math.min(min, 23 * 60 + 59);
  return `${String(Math.floor(c / 60)).padStart(2, '0')}${String(c % 60).padStart(2, '0')}00`;
};

/** Build an iCalendar file for the given range. Times are "floating" local times. */
export function buildICS(tasks: Task[], from: string, days: number, defaultDuration = 30): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Petalkeeper//EN', 'CALSCALE:GREGORIAN'];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    for (const o of itemsOn(tasks, date)) {
      const t = o.task;
      lines.push('BEGIN:VEVENT', `UID:${t.id}-${date}@petalkeeper`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(t.title)}`);
      if (t.start) {
        const endMin = t.end ? toMinutes(t.end) : toMinutes(t.start) + (t.duration ?? defaultDuration);
        lines.push(`DTSTART:${d8(date)}T${t6(t.start)}`, `DTEND:${d8(date)}T${hhmm(endMin)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${d8(date)}`, `DTEND;VALUE=DATE:${d8(addDays(date, 1))}`);
      }
      if (t.notes) lines.push(`DESCRIPTION:${esc(t.notes)}`);
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
