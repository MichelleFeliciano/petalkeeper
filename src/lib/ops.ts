import { newId, isDone } from './schedule';
import { toMinutes } from './dates';
import type { AppData, Checkin, Routine, RoutineDay, RoutineStep, Settings, Task } from './types';
import type { Starter } from './routines';

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

export const setRoutineKind = (d: AppData, id: string, kind: Routine['kind']): AppData => ({
  ...d,
  routines: d.routines.map((r) => (r.id === id ? { ...r, kind } : r)),
});

export const setRoutineDays = (d: AppData, id: string, days: number[]): AppData => ({
  ...d,
  routines: d.routines.map((r) => {
    if (r.id !== id) return r;
    const { days: _old, ...rest } = r;
    void _old;
    return days.length === 0 || days.length === 7 ? rest : { ...rest, days: [...days].sort((a, b) => a - b) };
  }),
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

/* ---------- routine extras ---------- */

export const addStarter = (d: AppData, s: Starter): AppData => ({
  ...d,
  routines: [
    ...d.routines,
    {
      id: newId(),
      kind: s.kind,
      name: s.name,
      ...(s.days ? { days: s.days } : {}),
      steps: s.steps.map((st) => ({ id: newId(), ...st })),
    },
  ],
});

export const duplicateRoutine = (d: AppData, id: string): AppData => {
  const r = d.routines.find((x) => x.id === id);
  if (!r) return d;
  const copy: Routine = { ...r, id: newId(), name: `${r.name} (copy)`, steps: r.steps.map((st) => ({ ...st, id: newId() })) };
  const at = d.routines.indexOf(r);
  return { ...d, routines: [...d.routines.slice(0, at + 1), copy, ...d.routines.slice(at + 1)] };
};

/** move a routine up or down among the routines of the same part of the day */
export const moveRoutine = (d: AppData, id: string, dir: -1 | 1): AppData => {
  const r = d.routines.find((x) => x.id === id);
  if (!r) return d;
  const same = d.routines.filter((x) => x.kind === r.kind);
  const j = same.indexOf(r) + dir;
  if (j < 0 || j >= same.length) return d;
  const other = same[j];
  const routines = [...d.routines];
  const a = routines.indexOf(r);
  const b = routines.indexOf(other);
  [routines[a], routines[b]] = [routines[b], routines[a]];
  return { ...d, routines };
};

export const setRoutineRemind = (d: AppData, id: string, remindAt: string | undefined): AppData => ({
  ...d,
  routines: d.routines.map((r) => {
    if (r.id !== id) return r;
    const { remindAt: _o, ...rest } = r;
    void _o;
    return remindAt ? { ...rest, remindAt } : rest;
  }),
});

/* ---------- little counters ---------- */

export const addCounter = (d: AppData, label: string, icon: string, goal: number): AppData => ({
  ...d,
  counters: [...d.counters, { id: newId(), label, icon, goal: Math.max(1, Math.round(goal)) }],
});

export const deleteCounter = (d: AppData, id: string): AppData => ({ ...d, counters: d.counters.filter((c) => c.id !== id) });

export const bumpCounter = (d: AppData, date: string, id: string, delta: number): AppData => {
  const row = d.counterLog[date] ?? {};
  const n = Math.max(0, (row[id] ?? 0) + delta);
  return { ...d, counterLog: { ...d.counterLog, [date]: { ...row, [id]: n } } };
};

/* ---------- daily check-in ---------- */

export const setCheckin = (d: AppData, date: string, patch: Partial<Checkin>): AppData => {
  const next = { ...d.checkins[date], ...patch };
  if (next.mood === undefined) delete next.mood;
  if (!next.note) delete next.note;
  const checkins = { ...d.checkins };
  if (next.mood === undefined && !next.note) delete checkins[date];
  else checkins[date] = next;
  return { ...d, checkins };
};

/* ---------- as-needed items, countdowns, planned pauses, timing ---------- */

export const addNeeded = (d: AppData, label: string, icon: string): AppData => ({ ...d, needed: [...d.needed, { id: newId(), label, icon }] });
export const deleteNeeded = (d: AppData, id: string): AppData => {
  const { [id]: _gone, ...log } = d.neededLog;
  void _gone;
  return { ...d, needed: d.needed.filter((n) => n.id !== id), neededLog: log };
};
export const markNeeded = (d: AppData, id: string, whenISO: string): AppData => ({
  ...d,
  neededLog: { ...d.neededLog, [id]: [...(d.neededLog[id] ?? []), whenISO].slice(-50) },
});
export const unmarkNeeded = (d: AppData, id: string): AppData => ({
  ...d,
  neededLog: { ...d.neededLog, [id]: (d.neededLog[id] ?? []).slice(0, -1) },
});

export const addCountdown = (d: AppData, label: string, icon: string, date: string): AppData => ({
  ...d,
  countdowns: [...d.countdowns, { id: newId(), label, icon, date }],
});
export const deleteCountdown = (d: AppData, id: string): AppData => ({ ...d, countdowns: d.countdowns.filter((c) => c.id !== id) });

export const addPlannedPause = (d: AppData, from: string, until: string): AppData => ({
  ...d,
  settings: { ...d.settings, plannedPauses: [...d.settings.plannedPauses, { id: newId(), from, until: until < from ? from : until }] },
});
export const removePlannedPause = (d: AppData, id: string): AppData => ({
  ...d,
  settings: { ...d.settings, plannedPauses: d.settings.plannedPauses.filter((p) => p.id !== id) },
});

const withDay = (d: AppData, date: string, rid: string, fn: (day: RoutineDay) => RoutineDay): AppData => {
  const day = d.routineLog[date]?.[rid] ?? { done: [], skipped: [] };
  return { ...d, routineLog: { ...d.routineLog, [date]: { ...d.routineLog[date], [rid]: fn(day) } } };
};
export const startRoutine = (d: AppData, date: string, rid: string, whenISO: string): AppData =>
  withDay(d, date, rid, (day) => {
    const { end: _e, ...rest } = day;
    void _e;
    return { ...rest, start: whenISO };
  });
export const finishRoutine = (d: AppData, date: string, rid: string, whenISO: string): AppData =>
  d.routineLog[date]?.[rid]?.start ? withDay(d, date, rid, (day) => ({ ...day, end: whenISO })) : d;

/* ---------- places and modes (Home, Mom's, Vacation, Road trip, …) ---------- */

export const setRoutinePlaces = (d: AppData, id: string, places: string[]): AppData => ({
  ...d,
  routines: d.routines.map((r) => {
    if (r.id !== id) return r;
    const { places: _p, ...rest } = r;
    void _p;
    return places.length === 0 || places.length === d.settings.places.length ? rest : { ...rest, places };
  }),
});

/** make a copy of a routine just for one place; the original steps aside from that place so nothing doubles up */
export const copyToPlace = (d: AppData, id: string, placeId: string): AppData => {
  const r = d.routines.find((x) => x.id === id);
  const place = d.settings.places.find((p) => p.id === placeId);
  if (!r || !place) return d;
  const allIds = d.settings.places.map((p) => p.id);
  const copy: Routine = { ...r, id: newId(), name: `${r.name} (${place.label})`, places: [placeId], steps: r.steps.map((st) => ({ ...st, id: newId() })) };
  const remaining = (r.places && r.places.length > 0 ? r.places : allIds).filter((x) => x !== placeId);
  const at = d.routines.indexOf(r);
  const updated: Routine = remaining.length === 0 ? r : { ...r, places: remaining };
  return { ...d, routines: [...d.routines.slice(0, at), updated, copy, ...d.routines.slice(at + 1)] };
};

export const addPlace = (d: AppData, label: string, icon: string): AppData => ({
  ...d,
  settings: { ...d.settings, places: [...d.settings.places, { id: newId(), label, icon }] },
});
export const renamePlace = (d: AppData, id: string, label: string, icon: string): AppData => ({
  ...d,
  settings: { ...d.settings, places: d.settings.places.map((p) => (p.id === id ? { ...p, label, icon } : p)) },
});
export const deletePlace = (d: AppData, id: string): AppData => {
  if (d.settings.places.length <= 1) return d;
  const places = d.settings.places.filter((p) => p.id !== id);
  const strip = (xs?: string[]) => {
    const rest = xs?.filter((x) => x !== id);
    return rest && rest.length > 0 ? rest : undefined;
  };
  return {
    ...d,
    routines: d.routines.map((r) => {
      const { places: _p, ...rest } = r;
      void _p;
      const np = strip(r.places);
      return {
        ...rest,
        ...(np ? { places: np } : {}),
        steps: r.steps.map((st) => {
          const { places: _sp, ...srest } = st;
          void _sp;
          const sp = strip(st.places);
          return sp ? { ...srest, places: sp } : srest;
        }),
      };
    }),
    settings: { ...d.settings, places, place: d.settings.place === id ? places[0].id : d.settings.place, stays: d.settings.stays.filter((s) => s.place !== id) },
  };
};
export const addStay = (d: AppData, place: string, from: string, until: string): AppData => ({
  ...d,
  settings: { ...d.settings, stays: [...d.settings.stays, { id: newId(), place, from, until: until < from ? from : until }] },
});
export const removeStay = (d: AppData, id: string): AppData => ({ ...d, settings: { ...d.settings, stays: d.settings.stays.filter((s) => s.id !== id) } });

/** end a planned stay early (you came home): it stops the day before `until`, or disappears if it hadn't started */
export const endStay = (d: AppData, id: string, lastDay: string): AppData => ({
  ...d,
  settings: {
    ...d.settings,
    stays: d.settings.stays.flatMap((s) => (s.id !== id ? [s] : lastDay < s.from ? [] : [{ ...s, until: lastDay < s.until ? lastDay : s.until }])),
  },
});
