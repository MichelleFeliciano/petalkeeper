import type { AppData, Counter, Countdown, Needed, Routine, Task, Template } from './types';

/** Things deleted in the last 30 days, kept on this device only so they can be brought back. */
export type TrashKind = 'task' | 'routine' | 'template' | 'counter' | 'needed' | 'countdown';
export interface TrashEntry {
  id: string;
  kind: TrashKind;
  title: string;
  /** ISO timestamp */
  at: string;
  item: Task | Routine | Template | Counter | Needed | Countdown;
  /** as-needed items also had a log of times */
  log?: string[];
}

const KEY = 'petalkeeper.trash';
const KEEP_DAYS = 30;
const MAX = 100;

export const KIND_LABEL: Record<TrashKind, string> = { task: 'Task', routine: 'Routine', template: 'Template', counter: 'Counter', needed: 'As-needed item', countdown: 'Countdown' };

export function loadTrash(now = Date.now()): TrashEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (e): e is TrashEntry => !!e && typeof e.id === 'string' && typeof e.kind === 'string' && !!e.item && typeof e.at === 'string' && now - new Date(e.at).getTime() < KEEP_DAYS * 86_400_000,
    );
  } catch {
    return [];
  }
}

export function saveTrash(list: TrashEntry[]): TrashEntry[] {
  const kept = list.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* storage full: the deletion still worked, it just can't be brought back later */
  }
  return kept;
}

const titleOf = (e: TrashEntry['item']) => ('title' in e ? e.title : 'name' in e ? e.name : e.label);

const poolOf = (d: AppData, kind: TrashKind): { id: string }[] =>
  kind === 'task' ? d.tasks : kind === 'routine' ? d.routines : kind === 'template' ? d.templates : kind === 'counter' ? d.counters : kind === 'needed' ? d.needed : d.countdowns;

/** the entry for something about to be deleted, or null when it isn't there */
export function trashEntryFor(d: AppData, kind: TrashKind, itemId: string, at = new Date().toISOString()): TrashEntry | null {
  const item = poolOf(d, kind).find((x) => x.id === itemId) as TrashEntry['item'] | undefined;
  if (!item) return null;
  return { id: `${kind}-${itemId}-${at}`, kind, title: titleOf(item) || 'Untitled', at, item, ...(kind === 'needed' ? { log: d.neededLog[itemId] ?? [] } : {}) };
}

/** is it already back in the app (for example because Undo was used)? */
export const isBack = (d: AppData, e: TrashEntry): boolean => poolOf(d, e.kind).some((x) => x.id === e.item.id);

export function restoreInto(d: AppData, e: TrashEntry): AppData {
  if (isBack(d, e)) return d;
  switch (e.kind) {
    case 'task': return { ...d, tasks: [...d.tasks, e.item as Task] };
    case 'routine': return { ...d, routines: [...d.routines, e.item as Routine] };
    case 'template': return { ...d, templates: [...d.templates, e.item as Template] };
    case 'counter': return { ...d, counters: [...d.counters, e.item as Counter] };
    case 'countdown': return { ...d, countdowns: [...d.countdowns, e.item as Countdown] };
    case 'needed': return { ...d, needed: [...d.needed, e.item as Needed], neededLog: e.log?.length ? { ...d.neededLog, [e.item.id]: e.log } : d.neededLog };
  }
}
