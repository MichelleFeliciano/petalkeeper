import { addDays, fromISO } from './dates';
import type { AppData, Counter } from './types';

const DAY = 86_400_000;

/** whole days from `today` to `date` (0 = today, negative = past) */
export const daysUntil = (date: string, today: string): number => Math.round((fromISO(date).getTime() - fromISO(today).getTime()) / DAY);

export function countdownText(label: string, date: string, today: string): string {
  const n = daysUntil(date, today);
  return n === 0 ? `${label} is today` : n === 1 ? `1 day until ${label}` : `${n} days until ${label}`;
}

/** "just now", "today at 8:10 AM", "yesterday at 9:00 PM", "3 days ago" */
export function lastDoneLabel(iso: string, now: Date): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const mins = Math.floor((now.getTime() - t.getTime()) / 60000);
  if (mins < 1) return 'just now';
  const time = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / DAY);
  if (days === 0) return mins < 60 ? `${mins} min ago` : `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  return `${days} days ago`;
}

/** minutes a routine usually takes, from days where Start and Finished were both pressed (median of the last 10) */
export function typicalMinutes(d: AppData, rid: string): { minutes: number; samples: number } | null {
  const spans: number[] = [];
  for (const date of Object.keys(d.routineLog).sort().reverse()) {
    const day = d.routineLog[date]?.[rid];
    if (day?.start && day.end) {
      const m = (new Date(day.end).getTime() - new Date(day.start).getTime()) / 60000;
      if (m > 0 && m < 600) spans.push(m);
    }
    if (spans.length >= 10) break;
  }
  if (spans.length < 2) return null;
  spans.sort((a, b) => a - b);
  return { minutes: Math.round(spans[Math.floor(spans.length / 2)]), samples: spans.length };
}

/** A soft, optional observation: a weekday that has tended to feel heavier than the rest. Needs several check-ins. */
export function weekdayInsight(d: AppData, upTo: string, daysBack = 90): string | null {
  const names = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  const sums = Array.from({ length: 7 }, () => ({ n: 0, total: 0 }));
  let all = 0;
  let count = 0;
  for (let i = 0; i < daysBack; i++) {
    const date = addDays(upTo, -i);
    const m = d.checkins[date]?.mood;
    if (!m) continue;
    const w = fromISO(date).getDay();
    sums[w].n++;
    sums[w].total += m;
    all += m;
    count++;
  }
  if (count < 14) return null;
  const mean = all / count;
  let worst = -1;
  let gap = 0;
  sums.forEach((s, w) => {
    if (s.n < 3) return;
    const g = mean - s.total / s.n;
    if (g > gap) {
      gap = g;
      worst = w;
    }
  });
  return worst >= 0 && gap >= 0.7 ? `${names[worst]} have tended to feel a little heavier. A gentle day or an extra-soft plan might help.` : null;
}

export function counterDay(d: AppData, date: string): { counter: Counter; n: number }[] {
  return d.counters.map((c) => ({ counter: c, n: d.counterLog[date]?.[c.id] ?? 0 })).filter((x) => x.n > 0);
}

/** split text into plain pieces and links so notes can hold URLs and phone numbers safely (no HTML is ever injected) */
export type Piece = { text: string; href?: string };
export function linkify(text: string): Piece[] {
  const out: Piece[] = [];
  const re = /(https?:\/\/[^\s]+)|(\+?\d[\d\s().-]{6,}\d)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    if (m[1]) out.push({ text: m[1], href: m[1] });
    else out.push({ text: m[2], href: 'tel:' + m[2].replace(/[^\d+]/g, '') });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** one step per line; bullets and numbers at the start of a line are dropped */
export function stepLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}
