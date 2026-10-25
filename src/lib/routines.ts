import { addDays, fromISO } from './dates';
import { routineOn } from './schedule';
import type { AppData, PartOfDay, Routine, RoutineStep, Settings } from './types';

/* ---------- pausing and gentle days ---------- */

export const isPaused = (s: Settings, date: string): boolean =>
  (!!s.pausedFrom && !!s.pausedUntil && s.pausedFrom <= date && date <= s.pausedUntil) || s.plannedPauses.some((p) => p.from <= date && date <= p.until);
export const isGentle = (s: Settings, date: string): boolean => s.gentleOn === date;
/** where you are on a date: a planned stay wins, otherwise the place you've switched to */
export const placeOn = (s: Settings, date: string): string =>
  s.stays.find((st) => st.from <= date && date <= st.until && s.places.some((p) => p.id === st.place))?.place ?? s.place;
/** things with no places listed belong everywhere */
export const atPlace = (x: { places?: string[] }, place: string): boolean => !x.places || x.places.length === 0 || x.places.includes(place);
export const placeLabel = (s: Settings, id: string) => s.places.find((p) => p.id === id);
export const stepOn = (st: RoutineStep, date: string): boolean => !st.days || st.days.length === 0 || st.days.includes(fromISO(date).getDay());

/** Steps that apply on this date: right weekday and, on a gentle day, only the essentials (if any are marked). */
export function stepsFor(r: Routine, date: string, gentle: boolean, place?: string): RoutineStep[] {
  const todays = r.steps.filter((st) => stepOn(st, date) && (place === undefined || atPlace(st, place)));
  if (!gentle) return todays;
  const keep = todays.filter((st) => st.essential);
  return keep.length > 0 ? keep : todays;
}

/** Routines to show on a date: the right weekday and not resting. */
export const routinesFor = (d: AppData, date: string): Routine[] =>
  isPaused(d.settings, date) ? [] : d.routines.filter((r) => routineOn(r, date) && atPlace(r, placeOn(d.settings, date)));

/** progress for one routine on one date, counting only what applies that day (optional steps never block "complete") */
export function progressOf(d: AppData, r: Routine, date: string, anyPlace = false) {
  const day = d.routineLog[date]?.[r.id] ?? { done: [], skipped: [] };
  const steps = stepsFor(r, date, isGentle(d.settings, date), anyPlace ? undefined : placeOn(d.settings, date)).filter((st) => !day.skipped.includes(st.id));
  const required = steps.filter((st) => !st.optional);
  const doneRequired = required.filter((st) => day.done.includes(st.id)).length;
  const done = steps.filter((st) => day.done.includes(st.id)).length;
  return { steps, day, done, total: steps.length, complete: required.length > 0 ? doneRequired === required.length : steps.length > 0 && done === steps.length };
}

/** the next step still waiting, and which routine it belongs to, starting with the current part of the day */
export function nextUp(d: AppData, date: string, part: PartOfDay, order: readonly PartOfDay[]) {
  const at = order.indexOf(part);
  const rotated = [...order.slice(at), ...order.slice(0, at)];
  const pool = routinesFor(d, date);
  for (const p of rotated) {
    for (const r of pool.filter((x) => x.kind === p)) {
      const pr = progressOf(d, r, date);
      const step = pr.steps.find((st) => !pr.day.done.includes(st.id) && !st.optional) ?? pr.steps.find((st) => !pr.day.done.includes(st.id));
      if (step && !pr.complete) return { routine: r, step, part: p, progress: pr };
    }
  }
  return null;
}

/* ---------- gentle history (no streaks, no scores) ---------- */

export type DayMark = 'off' | 'none' | 'some' | 'all';
/** one mark per date: 'off' = not scheduled that day, 'none' = nothing yet, 'some', 'all' = every step done */
export function historyFor(d: AppData, r: Routine, dates: string[]): DayMark[] {
  return dates.map((date) => {
    if (!routineOn(r, date)) return 'off';
    const pr = progressOf(d, r, date, true);
    // a routine for somewhere else is just resting that day, unless you did some of it anyway
    if (!atPlace(r, placeOn(d.settings, date)) && pr.done === 0) return 'off';
    if (pr.total === 0) return 'off';
    if (pr.complete) return 'all';
    return pr.done > 0 ? 'some' : 'none';
  });
}

/** "tended 5 of the last 7 scheduled days" */
export function recentTended(d: AppData, r: Routine, today: string, span = 7) {
  const dates = Array.from({ length: span }, (_, i) => addDays(today, -i));
  const marks = historyFor(d, r, dates);
  const scheduled = marks.filter((m) => m !== 'off').length;
  return { tended: marks.filter((m) => m === 'some' || m === 'all').length, scheduled };
}

/* ---------- starter routines ---------- */

export interface Starter {
  name: string;
  kind: PartOfDay;
  days?: number[];
  blurb: string;
  steps: { title: string; minutes?: number; essential?: boolean; optional?: boolean }[];
}

export const STARTERS: Starter[] = [
  {
    name: 'Wake-up',
    kind: 'morning',
    blurb: 'Gentle first things, no clock.',
    steps: [
      { title: 'Drink a glass of water', essential: true },
      { title: 'Shower', minutes: 10, essential: true },
      { title: 'Brush teeth', minutes: 3, essential: true },
      { title: 'Get dressed' },
      { title: 'Take morning medications (if you have any)', essential: true },
      { title: 'Open the curtains', optional: true },
    ],
  },
  {
    name: 'Midday reset',
    kind: 'midday',
    blurb: 'A pause in the middle of the day.',
    steps: [{ title: 'Eat something', essential: true }, { title: 'Drink water', essential: true }, { title: 'Step outside or stretch', minutes: 5, optional: true }],
  },
  {
    name: 'Wind-down',
    kind: 'evening',
    blurb: 'Close the day softly.',
    steps: [
      { title: 'Tidy one small spot', minutes: 5 },
      { title: 'Set out tomorrow\'s things' },
      { title: 'Take evening medications (if you have any)', essential: true },
      { title: 'Screens off, something calming', optional: true },
    ],
  },
  {
    name: 'Bedtime',
    kind: 'bedtime',
    blurb: 'Last things before sleep.',
    steps: [{ title: 'Brush teeth', minutes: 3, essential: true }, { title: 'Wash face', essential: true }, { title: 'Phone on the charger', essential: true }, { title: 'Lights out' }],
  },
  {
    name: 'Laundry day',
    kind: 'afternoon',
    days: [0],
    blurb: 'Set to Sundays; change the day any time.',
    steps: [{ title: 'Gather and sort laundry' }, { title: 'Start a load' }, { title: 'Move to the dryer' }, { title: 'Fold and put away' }, { title: 'Change the sheets', optional: true }],
  },
  {
    name: 'Therapy day',
    kind: 'afternoon',
    days: [2],
    blurb: 'Set to Tuesdays; change the day any time.',
    steps: [{ title: 'Jot down what I want to talk about' }, { title: 'Water and a snack before', essential: true }, { title: 'Head out in good time', essential: true }, { title: 'A quiet moment afterward' }],
  },
  {
    name: 'Weekly reset',
    kind: 'evening',
    days: [0],
    blurb: 'Set to Sundays.',
    steps: [{ title: 'Look at the week ahead' }, { title: 'Pick up the Seed Pouch' }, { title: 'Water the plants' }, { title: 'Take out the trash and recycling' }],
  },
];

/* ---------- phone-calendar export for routine nudges ---------- */

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
/** Recurring calendar events (with an alert) for every routine that has a nudge time, so your phone's own calendar can remind you. */
export function buildRoutineICS(routines: Routine[], fromDate: string): { text: string; count: number } {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Petalkeeper//EN', 'CALSCALE:GREGORIAN'];
  let count = 0;
  for (const r of routines) {
    if (!r.remindAt) continue;
    count++;
    const wanted = r.days && r.days.length > 0 && r.days.length < 7 ? r.days : null;
    let first = fromDate;
    for (let i = 0; wanted && i < 7 && !wanted.includes(fromISO(first).getDay()); i++) first = addDays(first, 1);
    const d8 = first.split('-').join('');
    const t = r.remindAt.replace(':', '') + '00';
    const [h, m] = r.remindAt.split(':').map(Number);
    const endMin = Math.min(h * 60 + m + 15, 23 * 60 + 59);
    const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}${String(endMin % 60).padStart(2, '0')}00`;
    const rule = r.days && r.days.length > 0 && r.days.length < 7 ? `FREQ=WEEKLY;BYDAY=${[...r.days].sort((a, b) => a - b).map((x) => BYDAY[x]).join(',')}` : 'FREQ=DAILY';
    const esc = (s: string) => s.split('\\').join('\\\\').split(';').join('\\;').split(',').join('\\,');
    lines.push(
      'BEGIN:VEVENT',
      `UID:routine-${r.id}@petalkeeper`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${esc(r.name)}`,
      `DTSTART:${d8}T${t}`,
      `DTEND:${d8}T${end}`,
      `RRULE:${rule}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(r.name)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return { text: lines.join('\r\n') + '\r\n', count };
}
