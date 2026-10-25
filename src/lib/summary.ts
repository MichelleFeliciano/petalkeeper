import { isDone, itemsOn } from './schedule';
import { historyFor, progressOf, routinesFor } from './routines';
import { addDays } from './dates';
import type { AppData } from './types';

export interface WeekSummary {
  done: number;
  total: number;
  routineSteps: number;
  byCategory: Record<string, number>;
  message: string;
  /** how many days had a mood logged, and the most common one */
  moodDays: number;
  commonMood?: number;
  /** routines completed on the days they were scheduled */
  routinesComplete: number;
  routinesScheduled: number;
}

/** A kind look back. No scores, no streaks. */
export function weekSummary(d: AppData, dates: string[]): WeekSummary {
  let done = 0;
  let total = 0;
  const byCategory: Record<string, number> = {};
  for (const date of dates) {
    for (const o of itemsOn(d.tasks, date)) {
      total++;
      if (isDone(o.task, o.date)) {
        done++;
        byCategory[o.task.category] = (byCategory[o.task.category] ?? 0) + 1;
      }
    }
  }
  let routineSteps = 0;
  for (const date of dates) for (const day of Object.values(d.routineLog[date] ?? {})) routineSteps += day.done.length;
  const moods: Record<number, number> = {};
  let moodDays = 0;
  for (const date of dates) {
    const m = d.checkins[date]?.mood;
    if (m) {
      moodDays++;
      moods[m] = (moods[m] ?? 0) + 1;
    }
  }
  const commonMood = Number(Object.entries(moods).sort((a, b) => b[1] - a[1])[0]?.[0]) || undefined;
  let routinesComplete = 0;
  let routinesScheduled = 0;
  for (const date of dates) {
    for (const r of routinesFor(d, date)) {
      const pr = progressOf(d, r, date);
      if (pr.total === 0) continue;
      routinesScheduled++;
      if (pr.complete) routinesComplete++;
    }
  }
  const message =
    done + routineSteps === 0
      ? 'A quiet week. Your garden is patient and will be here whenever you are ready.'
      : 'Look at everything you tended to. Thank you for taking care of yourself.';
  return { done, total, routineSteps, byCategory, message, moodDays, commonMood, routinesComplete, routinesScheduled };
}

/* ---------- a summary for a stretch of days (for you, or to share with someone like a therapist) ---------- */

export interface Report {
  from: string;
  to: string;
  days: number;
  moodDays: number;
  avgMood?: number;
  moodCounts: Record<number, number>;
  notes: { date: string; mood?: number; note?: string }[];
  routines: { name: string; scheduled: number; tended: number; complete: number }[];
  counters: { label: string; total: number; days: number }[];
}

export function buildReport(d: AppData, from: string, to: string): Report {
  const dates: string[] = [];
  for (let x = from; x <= to && dates.length < 400; x = addDays(x, 1)) dates.push(x);
  const moodCounts: Record<number, number> = {};
  let sum = 0;
  let moodDays = 0;
  const notes: Report['notes'] = [];
  for (const date of dates) {
    const c = d.checkins[date];
    if (!c) continue;
    if (c.mood) {
      moodDays++;
      sum += c.mood;
      moodCounts[c.mood] = (moodCounts[c.mood] ?? 0) + 1;
    }
    if (c.mood || c.note) notes.push({ date, mood: c.mood, note: c.note });
  }
  const routines = d.routines.map((r) => {
    const marks = historyFor(d, r, dates);
    return {
      name: r.name,
      scheduled: marks.filter((m) => m !== 'off').length,
      tended: marks.filter((m) => m === 'some' || m === 'all').length,
      complete: marks.filter((m) => m === 'all').length,
    };
  });
  const counters = d.counters.map((c) => {
    const vals = dates.map((date) => d.counterLog[date]?.[c.id] ?? 0);
    return { label: c.label, total: vals.reduce((a, b) => a + b, 0), days: vals.filter((v) => v > 0).length };
  });
  return { from, to, days: dates.length, moodDays, avgMood: moodDays ? Math.round((sum / moodDays) * 10) / 10 : undefined, moodCounts, notes, routines, counters };
}

export interface ReportInclude {
  moods: boolean;
  notes: boolean;
  routines: boolean;
  counters: boolean;
}

/** plain text version, for copying into a message */
export function reportText(r: Report, inc: ReportInclude): string {
  const lines = [`Petalkeeper summary, ${r.from} to ${r.to} (${r.days} days)`, ''];
  if (inc.moods) {
    lines.push(r.moodDays ? `Mood: ${r.moodDays} check-ins, average ${r.avgMood} of 5 (1 = heavy, 5 = bright).` : 'Mood: no check-ins in this period.');
    lines.push('');
  }
  if (inc.routines && r.routines.length > 0) {
    lines.push('Routines (days tended / days scheduled, fully finished):');
    for (const x of r.routines) lines.push(`- ${x.name}: ${x.tended}/${x.scheduled}, ${x.complete} fully finished`);
    lines.push('');
  }
  if (inc.counters && r.counters.length > 0) {
    lines.push('Counters:');
    for (const x of r.counters) lines.push(`- ${x.label}: ${x.total} total over ${x.days} days`);
    lines.push('');
  }
  if (inc.notes && r.notes.length > 0) {
    lines.push('Notes:');
    for (const n of r.notes) lines.push(`${n.date}${n.mood ? ` (mood ${n.mood}/5)` : ''}${n.note ? ': ' + n.note : ''}`);
  }
  return lines.join('\n').trim() + '\n';
}
