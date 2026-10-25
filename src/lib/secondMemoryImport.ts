import { isISODate } from './dates';
import { makeTask } from './schedule';
import type { Recurrence, Task } from './types';

/**
 * A one-time copy of the to-do list in the Second Memory app. The apps are NOT connected: this reads a Second Memory
 * "Export data" file (or the list Second Memory left in this same browser) and makes ordinary Petalkeeper tasks.
 * Only the to-do list is read; nothing else in the file is touched.
 */

/** Second Memory keeps its to-dos in this localStorage key (see second-memory/app.js, TODOS_KEY). */
export const SECOND_MEMORY_TODOS_KEY = 'secondMemory.todos.v1';
/** Copied tasks get this id prefix, so copying again skips the ones already here. */
export const SM_PREFIX = 'sm-';

interface SmTodo {
  id?: unknown; task?: unknown; completed?: unknown; repeat?: unknown; dueDate?: unknown; repeatDay?: unknown;
  spawnedId?: unknown; sortOrder?: unknown; dateAdded?: unknown; deleted?: unknown;
}

export interface CopyPlan {
  /** tasks that will be added */
  fresh: Task[];
  /** copied before (same id), so skipped */
  alreadyHere: number;
  /** could not be read, named so nothing disappears silently */
  unreadable: string[];
}

/** Pulls the to-do list out of an export (`{collections:{todos:[…]}}`), a bare `{todos:[…]}`, or a bare array. */
export function extractTodos(parsed: unknown): SmTodo[] | null {
  const pick = (v: unknown): SmTodo[] | null => (Array.isArray(v) ? v.filter((r): r is SmTodo => !!r && typeof r === 'object') : null);
  if (Array.isArray(parsed)) return pick(parsed);
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as { collections?: { todos?: unknown }; todos?: unknown };
  return pick(o.collections?.todos) ?? pick(o.todos);
}

const text = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isoStamp = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const REPEATS: Record<string, Recurrence['freq']> = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' };

/**
 * Work out what copying would do, without changing anything.
 * - A finished to-do stays finished (its repeat ended when the next one was made, so it is a plain task).
 * - An open repeating to-do becomes a repeating task starting on its due date. A monthly one that Second Memory
 *   shortened to fit a short month ("the 31st" shown as the 28th) keeps its real day (`dom`).
 * - The due date becomes the task's day, so it shows on the week and in the list. The hand order is kept.
 */
export function planTodoCopy(records: SmTodo[], haveIds: Iterable<string>, now = new Date()): CopyPlan {
  const have = new Set(haveIds);
  const plan: CopyPlan = { fresh: [], alreadyHere: 0, unreadable: [] };
  const seen = new Set<string>();
  for (const r of records) {
    if (r.deleted === true) continue; // Second Memory keeps deleted to-dos as hidden "tombstones"
    const title = text(r.task, 200);
    const smId = text(r.id, 60);
    if (!title || !smId) { plan.unreadable.push(title || '(a to-do with no text)'); continue; }
    const id = `${SM_PREFIX}${smId}`;
    if (have.has(id) || seen.has(id)) { plan.alreadyHere++; continue; }
    seen.add(id);

    const done = r.completed === true;
    const date = isISODate(r.dueDate) ? r.dueDate : undefined;
    const freq = typeof r.repeat === 'string' ? REPEATS[r.repeat] : undefined;
    const recurrence: Recurrence | undefined = !done && freq ? { freq } : undefined;
    if (recurrence && freq === 'monthly' && date && typeof r.repeatDay === 'number' && Number.isInteger(r.repeatDay) && r.repeatDay >= 1 && r.repeatDay <= 31 && r.repeatDay !== Number(date.slice(8))) {
      recurrence.dom = r.repeatDay;
    }
    const created = isoStamp(r.dateAdded) ?? now.toISOString();
    plan.fresh.push(makeTask({
      id, title, done, createdAt: created,
      ...(date ? { date } : {}),
      ...(recurrence ? { recurrence } : {}),
      ...(typeof r.sortOrder === 'number' && Number.isFinite(r.sortOrder) ? { order: r.sortOrder } : {}),
    }));
  }
  return plan;
}
