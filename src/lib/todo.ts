import { addDays } from './dates';
import { isDone, nextOccurrence, occursOn } from './schedule';
import type { Task } from './types';

/** Pure rules for the to-do list (the Seed Pouch): sorting, what needs attention, hand ordering. No React, no storage. */

export type TodoSort = 'date_asc' | 'date_desc' | 'manual' | 'added_desc' | 'added_asc';
export const TODO_SORTS: Array<[TodoSort, string]> = [
  ['date_asc', 'Soonest first'], ['date_desc', 'Latest first'], ['manual', 'My order'], ['added_desc', 'Newest added'], ['added_asc', 'Oldest added'],
];

/** The gap left between hand-arranged tasks. */
export const ORDER_GAP = 1000;

/** The day a task counts for in a list: a recurring task's next day, otherwise its scheduled day, else its due day. */
export function listDate(t: Task, today: string): string | undefined {
  if (t.recurrence) return nextOccurrence(t, today);
  return t.date ?? t.due;
}

/** Open (not finished) one-off tasks that are late: their day, or their due date, has passed. */
export function isOverdue(t: Task, today: string): boolean {
  if (t.recurrence || t.done) return false;
  return (!!t.date && t.date < today) || (!!t.due && t.due < today);
}

const byAdded = (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt);

/** Sorted copy. Finished tasks always come last; tasks without a day sort after those with one (soonest first), or before (latest first). */
export function sortTodos(tasks: Task[], sort: TodoSort, today: string): Task[] {
  const rank = (t: Task) => (t.recurrence ? 0 : t.done ? 1 : 0);
  const manual = (a: Task, b: Task) => {
    const ao = a.order, bo = b.order;
    if (ao !== undefined && bo !== undefined) return ao - bo || byAdded(a, b);
    if (ao !== undefined) return -1;
    if (bo !== undefined) return 1;
    return byAdded(a, b);
  };
  // Tasks without a day always go last, whichever way the dated ones run.
  const dated = (dir: 1 | -1) => (a: Task, b: Task) => {
    const da = listDate(a, today), db = listDate(b, today);
    if (!da && !db) return byAdded(a, b);
    if (!da) return 1;
    if (!db) return -1;
    return dir * da.localeCompare(db) || byAdded(a, b);
  };
  const cmp: Record<TodoSort, (a: Task, b: Task) => number> = {
    date_asc: dated(1),
    date_desc: dated(-1),
    manual,
    added_desc: (a, b) => byAdded(b, a),
    added_asc: byAdded,
  };
  return [...tasks].sort((a, b) => rank(a) - rank(b) || cmp[sort](a, b));
}

/**
 * Things that need attention: open one-off tasks that are overdue or fall in the next `days` days (today included),
 * soonest first, plus how many of them are overdue. Recurring tasks already show on their own days.
 */
export function needsAttention(tasks: Task[], today: string, days = 7): { late: Task[]; soon: Task[] } {
  const end = addDays(today, days);
  const open = tasks.filter((t) => !t.recurrence && !t.done);
  const late = open.filter((t) => isOverdue(t, today));
  const soon = open.filter((t) => !isOverdue(t, today) && ((t.date && t.date >= today && t.date <= end) || (!t.date && t.due && t.due >= today && t.due <= end)));
  const key = (t: Task) => t.date ?? t.due ?? '9999';
  return { late: late.sort((a, b) => key(a).localeCompare(key(b))), soon: soon.sort((a, b) => key(a).localeCompare(key(b))) };
}

/** How many open one-off tasks without a clock time are due today or already late: what a daily to-do reminder counts. */
export function reminderCount(tasks: Task[], today: string): number {
  return tasks.filter((t) => !t.recurrence && !t.done && !t.start && ((t.date && t.date <= today) || (!t.date && t.due && t.due <= today))).length;
}

export const reminderText = (n: number) => `${n} to-do${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} a look today`;

/** The day to snooze to: tomorrow or a week from today. */
export const snoozeTo = (today: string, kind: 'tomorrow' | 'week') => addDays(today, kind === 'tomorrow' ? 1 : 7);

/** Only a task that is late or due today can be snoozed (anything later is already out of the way). */
export function canSnooze(t: Task, today: string): boolean {
  if (t.done && !t.recurrence) return false;
  if (t.recurrence) return occursOn(t, today) && !isDone(t, today);
  const d = t.date ?? t.due;
  return !!d && d <= today;
}

/** New hand order after moving one task: every id with a new `order`, ORDER_GAP apart; [] when nothing would change. */
export function reorder(ordered: string[], id: string, toIndex: number): Array<{ id: string; order: number }> {
  const from = ordered.indexOf(id);
  if (from < 0) return [];
  const to = Math.max(0, Math.min(ordered.length - 1, toIndex));
  if (to === from) return [];
  const next = [...ordered];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next.map((x, i) => ({ id: x, order: (i + 1) * ORDER_GAP }));
}
export const stepTask = (ordered: string[], id: string, dir: -1 | 1) => reorder(ordered, id, ordered.indexOf(id) + dir);

/** Month grid helpers: which days of a month have which kinds of open items. */
export function monthDays(year: number, month: number, weekStart: 0 | 1): Array<string | null> {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStart + 7) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => `${year}-${p(month + 1)}-${p(i + 1)}`)];
}
