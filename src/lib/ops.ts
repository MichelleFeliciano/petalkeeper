import { newId, isDone } from './schedule';
import { toMinutes } from './dates';
import type { AppData, Routine, RoutineDay, RoutineStep, Settings, Task } from './types';

/** Pure data transformations. The store wraps these so they are easy to test. */

const mapTask = (d: AppData, id: string, fn: (t: Task) => Task): AppData => ({
  ...d,
  tasks: d.tasks.map((t) => (t.id === id ? fn(t) : t)),
});

export const addTask = (d: AppData, t: Task): AppData => ({ ...d, tasks: [...d.tasks, t] });

export const updateTask = (d: AppData, id: string, patch: Partial<Task>): AppData =>
  mapTask(d, id, (t) => ({ ...t, ...patch }));

export const deleteTask = (d: AppData, id: string): AppData => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) });

/** Remove just one occurrence of a recurring task (one-off tasks are deleted outright). */
export function deleteOccurrence(d: AppData, id: string, date: string): AppData {
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return d;
  if (!t.recurrence) return deleteTask(d, id);
  return mapTask(d, id, (x) => ({ ...x, skipped: [...new Set([...x.skipped, date])] }));
}

export function duplicateTask(d: AppData, id: string): AppData {
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return d;
  const copy: Task = {
    ...t,
    id: newId(),
    title: t.title + ' (copy)',
    done: false,
    completions: [],
    skipped: [],
    subDone: {},
    subtasks: t.subtasks.map((s) => ({ ...s, id: newId(), done: false })),
  };
  return addTask(d, copy);
}

/** Completing only affects this date. Blooms only ever grow. */
export function toggleDone(d: AppData, id: string, date: string): AppData {
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return d;
  const was = isDone(t, date);
  const next = mapTask(d, id, (x) =>
    x.recurrence
      ? { ...x, completions: was ? x.completions.filter((c) => c !== date) : [...x.completions, date] }
      : { ...x, done: !was },
  );
  return was ? next : { ...next, blooms: next.blooms + 1 };
}

export function toggleSubtask(d: AppData, id: string, date: string, subId: string): AppData {
  return mapTask(d, id, (t) => {
    if (t.recurrence) {
      const cur = t.subDone[date] ?? [];
      const nxt = cur.includes(subId) ? cur.filter((s) => s !== subId) : [...cur, subId];
      return { ...t, subDone: { ...t.subDone, [date]: nxt } };
    }
    return { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) };
  });
}

export interface MoveTarget {
  /** undefined = take it off the calendar (back to the Seed Pouch) */
  date?: string;
  start?: string;
  end?: string;
}

/**
 * Move one occurrence somewhere else without recreating it.
 * One-off task: edit in place. Recurring: skip that date and create a one-off copy.
 */
export function moveOccurrence(d: AppData, id: string, fromDate: string, to: MoveTarget): AppData {
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return d;
  const length = t.start && t.end ? toMinutes(t.end) - toMinutes(t.start) : t.duration;
  const timing: Partial<Task> = to.start
    ? { date: to.date, start: to.start, end: undefined, duration: length }
    : to.date
      ? { date: to.date }
      : { date: undefined, start: undefined, end: undefined, duration: length };
  if (!t.recurrence) {
    return mapTask(d, id, (x) => ({ ...x, ...timing }));
  }
  const skipped = mapTask(d, id, (x) => ({ ...x, skipped: [...new Set([...x.skipped, fromDate])] }));
  if (!to.date && !to.start) return skipped; // "leave for another day": just skip this one
  const copy: Task = {
    ...t,
    id: newId(),
    recurrence: undefined,
    done: false,
    completions: [],
    skipped: [],
    subDone: {},
    subtasks: t.subtasks.map((s) => ({ ...s, id: newId(), done: false })),
    ...timing,
  };
  return addTask(skipped, copy);
}

/** Copy a day's one-off tasks to another day (recurring ones already repeat on their own). */
export function copyDay(d: AppData, from: string, to: string): AppData {
  const copies = d.tasks
    .filter((t) => !t.recurrence && t.date === from)
    .map<Task>((t) => ({
      ...t,
      id: newId(),
      date: to,
      done: false,
      subtasks: t.subtasks.map((s) => ({ ...s, id: newId(), done: false })),
    }));
  return { ...d, tasks: [...d.tasks, ...copies] };
}

export const updateSettings = (d: AppData, p: Partial<Settings>): AppData => ({ ...d, settings: { ...d.settings, ...p } });

/* ---------- routines ---------- */

export const addRoutine = (d: AppData, kind: Routine['kind'], name: string): AppData => ({
  ...d,
  routines: [...d.routines, { id: newId(), kind, name, steps: [] }],
});

export const renameRoutine = (d: AppData, id: string, name: string): AppData => ({
  ...d,
  routines: d.routines.map((r) => (r.id === id ? { ...r, name } : r)),
});

export const deleteRoutine = (d: AppData, id: string): AppData => ({
  ...d,
  routines: d.routines.filter((r) => r.id !== id),
});

export const setSteps = (d: AppData, id: string, steps: RoutineStep[]): AppData => ({
  ...d,
  routines: d.routines.map((r) => (r.id === id ? { ...r, steps } : r)),
});

export function routineDay(d: AppData, date: string, routineId: string): RoutineDay {
  return d.routineLog[date]?.[routineId] ?? { done: [], skipped: [] };
}

function setRoutineDay(d: AppData, date: string, rid: string, day: RoutineDay): AppData {
  return { ...d, routineLog: { ...d.routineLog, [date]: { ...(d.routineLog[date] ?? {}), [rid]: day } } };
}

export function toggleStep(d: AppData, date: string, rid: string, stepId: string): AppData {
  const day = routineDay(d, date, rid);
  const was = day.done.includes(stepId);
  const next = setRoutineDay(d, date, rid, {
    done: was ? day.done.filter((s) => s !== stepId) : [...day.done, stepId],
    skipped: day.skipped.filter((s) => s !== stepId),
  });
  return was ? next : { ...next, blooms: next.blooms + 1 };
}

export function toggleSkipStep(d: AppData, date: string, rid: string, stepId: string): AppData {
  const day = routineDay(d, date, rid);
  const was = day.skipped.includes(stepId);
  return setRoutineDay(d, date, rid, {
    done: day.done.filter((s) => s !== stepId),
    skipped: was ? day.skipped.filter((s) => s !== stepId) : [...day.skipped, stepId],
  });
}

/* ---------- edit one occurrence, templates ---------- */

/** Change just one day of a repeating task: skip it in the series and add an edited one-off copy. */
export function splitOccurrence(d: AppData, id: string, date: string, patch: Partial<Task>): AppData {
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return d;
  if (!t.recurrence) return updateTask(d, id, patch);
  const skipped = mapTask(d, id, (x) => ({ ...x, skipped: [...new Set([...x.skipped, date])] }));
  const copy: Task = {
    ...t,
    ...patch,
    id: newId(),
    recurrence: undefined,
    date: patch.date ?? date,
    done: false,
    completions: [],
    skipped: [],
    subDone: {},
    subtasks: (patch.subtasks ?? t.subtasks).map((s) => ({ ...s, id: newId(), done: false })),
  };
  return addTask(skipped, copy);
}

export function saveTemplate(d: AppData, name: string, tasks: Task[]): AppData {
  const items = tasks.map((t) => ({
    title: t.title,
    notes: t.notes,
    category: t.category,
    priority: t.priority,
    start: t.start,
    end: t.end,
    duration: t.duration,
    subtasks: t.subtasks.map((s) => s.title),
  }));
  return { ...d, templates: [...d.templates, { id: newId(), name, items }] };
}

export function applyTemplate(d: AppData, templateId: string, date: string): AppData {
  const tpl = d.templates.find((t) => t.id === templateId);
  if (!tpl) return d;
  const created: Task[] = tpl.items.map((i) => ({
    id: newId(),
    title: i.title,
    notes: i.notes,
    category: i.category,
    priority: i.priority,
    start: i.start,
    end: i.end,
    duration: i.duration,
    date,
    subtasks: i.subtasks.map((title) => ({ id: newId(), title, done: false })),
    done: false,
    completions: [],
    skipped: [],
    subDone: {},
    createdAt: date + 'T00:00:00.000Z',
  }));
  return { ...d, tasks: [...d.tasks, ...created] };
}

export const deleteTemplate = (d: AppData, id: string): AppData => ({ ...d, templates: d.templates.filter((t) => t.id !== id) });
