import { fromISO, toISO, toMinutes, weekday, addDays } from './dates';
import type { Task } from './types';

export interface Occurrence {
  task: Task;
  date: string;
  /** unique per task per date */
  key: string;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function anchorOf(t: Task): string {
  return t.date ?? t.createdAt.slice(0, 10);
}

export function occursOn(t: Task, date: string): boolean {
  const r = t.recurrence;
  if (!r) return t.date === date;
  const anchor = anchorOf(t);
  if (date < anchor) return false;
  if (r.until && date > r.until) return false;
  if (t.skipped.includes(date)) return false;
  switch (r.freq) {
    case 'daily':
      return true;
    case 'days':
      return (r.days ?? []).includes(weekday(date));
    case 'weekly':
      return weekday(date) === weekday(anchor);
    case 'monthly': {
      const a = fromISO(anchor);
      const d = fromISO(date);
      return d.getDate() === Math.min(a.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
    }
  }
}

export function isDone(t: Task, date: string): boolean {
  return t.recurrence ? t.completions.includes(date) : t.done;
}

export function subtaskDone(t: Task, date: string, subId: string): boolean {
  if (t.recurrence) return (t.subDone[date] ?? []).includes(subId);
  return t.subtasks.find((s) => s.id === subId)?.done ?? false;
}

export function itemsOn(tasks: Task[], date: string): Occurrence[] {
  return tasks
    .filter((t) => occursOn(t, date))
    .map((task) => ({ task, date, key: `${task.id}@${date}` }))
    .sort((a, b) => {
      const as = a.task.start ?? '99:99';
      const bs = b.task.start ?? '99:99';
      return as === bs ? a.task.title.localeCompare(b.task.title) : as.localeCompare(bs);
    });
}

/** [startMin, endMin] for a timed task, or null */
export function span(t: Task, defaultDuration: number): [number, number] | null {
  if (!t.start) return null;
  const s = toMinutes(t.start);
  const e = t.end ? toMinutes(t.end) : s + (t.duration ?? defaultDuration);
  return [s, Math.max(e, s + 1)];
}

/** keys of unfinished occurrences that overlap another (or sit closer than `buffer` minutes) */
export function findConflicts(items: Occurrence[], defaultDuration: number, buffer = 0): Set<string> {
  const timed = items
    .filter((o) => !isDone(o.task, o.date))
    .map((o) => ({ o, s: span(o.task, defaultDuration) }))
    .filter((x): x is { o: Occurrence; s: [number, number] } => x.s !== null);
  const bad = new Set<string>();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.o.date !== b.o.date) continue;
      if (a.s[0] < b.s[1] + buffer && b.s[0] < a.s[1] + buffer) {
        bad.add(a.o.key);
        bad.add(b.o.key);
      }
    }
  }
  return bad;
}

export function describeRecurrence(t: Task): string {
  const r = t.recurrence;
  if (!r) return '';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let s = '';
  if (r.freq === 'daily') s = 'Every day';
  else if (r.freq === 'days') s = 'Every ' + (r.days ?? []).map((d) => names[d]).join(', ');
  else if (r.freq === 'weekly') s = 'Weekly';
  else s = 'Monthly';
  return r.until ? `${s} until ${r.until}` : s;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function makeTask(p: Partial<Task> & { title: string }): Task {
  return {
    id: newId(),
    notes: '',
    category: 'other',
    priority: 'normal',
    subtasks: [],
    done: false,
    completions: [],
    skipped: [],
    subDone: {},
    createdAt: toISO(new Date()) + 'T00:00:00.000Z',
    ...p,
  };
}

/** next scheduled date (>= from) for a task within a year, for display */
export function nextOccurrence(t: Task, from: string): string | undefined {
  for (let i = 0; i < 366; i++) {
    const d = addDays(from, i);
    if (occursOn(t, d)) return d;
  }
  return undefined;
}
