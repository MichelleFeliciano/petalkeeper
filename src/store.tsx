import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadData, saveData } from './lib/storage';
import { sampleData } from './lib/seed';
import { DEFAULT_SETTINGS, type AppData } from './lib/types';
import * as ops from './lib/ops';
import { todayISO } from './lib/dates';

type Fn<A extends unknown[]> = (...a: A) => void;
type Tail<F> = F extends (d: AppData, ...rest: infer R) => AppData ? Fn<R> : never;

type Wrapped = { [K in keyof typeof ops as (typeof ops)[K] extends (d: AppData, ...r: never[]) => AppData ? K : never]: Tail<(typeof ops)[K]> };

export interface Toast {
  id: number;
  text: string;
  undoable: boolean;
}

export interface Store extends Wrapped {
  data: AppData;
  today: string;
  saveFailed: boolean;
  toast: Toast | null;
  replaceAll: (d: AppData) => void;
  resetSample: () => void;
  resetEverything: () => void;
  /** show a brief, friendly message */
  notify: (text: string) => void;
  /** take back the latest change to tasks (or routines/templates), up to the last 50 */
  undo: () => void;
  /** do again what was just taken back */
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  dismissToast: () => void;
  /** run an action and offer to undo it for a few seconds */
  undoable: (label: string, run: () => void) => void;
}

/** operations that offer a few seconds to undo, with the message to show */
const UNDOABLE: Record<string, string> = {
  deleteTask: 'Removed.',
  deleteOccurrence: 'Removed for that day.',
  moveOccurrence: 'Moved.',
  copyDay: "Copied. It's yours to adjust.",
  deleteRoutine: 'Routine removed.',
  applyTemplate: 'Template added.',
  splitOccurrence: 'Saved for just that day.',
  deleteTemplate: 'Template removed.',
  snoozeTask: 'Put off for later.',
  importTasks: 'Brought in.',
};

/** other operations that change tasks quietly (no toast) but can still be undone and redone with the Undo and Redo buttons */
const QUIET_HISTORY = new Set(['addTask', 'updateTask', 'duplicateTask', 'toggleDone', 'toggleSubtask', 'setOrder']);

/** changes made within this many milliseconds of each other (one tap that changes several things) share one undo step */
const COALESCE_MS = 300;

/** how many steps back Undo can go */
const HISTORY_LIMIT = 50;

/** Undo and Redo bring back tasks, routines and templates only. Everything else (check-offs, notes, counters, settings) stays as it is now. */
type Part = 'tasks' | 'routines' | 'templates' | 'routineLog';
interface Entry {
  /** how things were before the change */
  d: AppData;
  /** the parts of the data this step brings back */
  parts: Part[];
}
const TASK_PARTS: Part[] = ['tasks', 'routines', 'templates'];
/** ticking a routine step off (or skipping it) from the "do this now" card can be undone too, and only that is brought back */
const ROUTINE_LOG_OPS = new Set(['toggleStep', 'toggleSkipStep']);
const restore = (e: Entry) => (d: AppData): AppData => {
  const next = { ...d } as Record<string, unknown>;
  for (const p of e.parts) next[p] = e.d[p];
  return next as unknown as AppData;
};

const Ctx = createContext<Store | null>(null);
let toastId = 0;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const [today, setToday] = useState(todayISO());
  const [saveFailed, setSaveFailed] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  // Snapshots before each tracked change (past) and the ones undone (future).
  const past = useRef<Entry[]>([]);
  const future = useRef<Entry[]>([]);
  const snapAt = useRef(0);
  const current = useRef<AppData>(data);
  const [, setHistoryTick] = useState(0);
  const labelOverride = useRef<string | null>(null);

  useEffect(() => {
    current.current = data;
    setSaveFailed(!saveData(data));
  }, [data]);

  // Roll over to the new day while the app is left open.
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const apply = () => {
      const dark = data.settings.theme === 'dark' || (data.settings.theme === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (data.settings.theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [data.settings.theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((c) => (c?.id === toast.id ? null : c)), toast.undoable ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const apply = useCallback((fn: (d: AppData) => AppData, label?: string, tracked = false, parts: Part[] = TASK_PARTS) => {
    setData((d) => {
      // several changes made together (e.g. Adjust My Day) share one undo step
      // only changes to the same kind of thing share a step, so a quick routine tick never swallows a task change
      const last = past.current[past.current.length - 1];
      const together = !!last && Date.now() - snapAt.current <= COALESCE_MS && last.parts.join() === parts.join();
      if (tracked && !together && last?.d !== d) {
        past.current.push({ d, parts });
        if (past.current.length > HISTORY_LIMIT) past.current.shift();
        future.current = [];
        snapAt.current = Date.now();
      }
      return fn(d);
    });
    if (tracked) setHistoryTick((n) => n + 1);
    if (label) setToast({ id: ++toastId, text: label, undoable: true });
  }, []);

  const store = useMemo<Store>(() => {
    const clearHistory = () => {
      past.current = [];
      future.current = [];
      setHistoryTick((n) => n + 1);
      setToast((t) => (t?.undoable ? null : t));
    };
    const w: Record<string, unknown> = {};
    for (const [name, fn] of Object.entries(ops)) {
      if (name === 'routineDay') continue;
      const label = UNDOABLE[name];
      const tracked = !!label || QUIET_HISTORY.has(name);
      w[name] = (...args: unknown[]) =>
        apply((d) => (fn as (d: AppData, ...a: unknown[]) => AppData)(d, ...args), labelOverride.current ?? label, tracked || !!labelOverride.current, ROUTINE_LOG_OPS.has(name) ? ['routineLog'] : TASK_PARTS);
    }
    return {
      ...(w as unknown as Wrapped),
      data,
      today,
      saveFailed,
      toast,
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      replaceAll: (d: AppData) => {
        clearHistory();
        setData(d);
      },
      resetSample: () => {
        clearHistory();
        setData({ ...sampleData(), settings: data.settings });
      },
      resetEverything: () => {
        clearHistory();
        setData({ version: 1, tasks: [], routines: [], routineLog: {}, settings: { ...DEFAULT_SETTINGS }, blooms: 0, templates: [], counters: [], counterLog: {}, checkins: {}, needed: [], neededLog: {}, countdowns: [] });
      },
      notify: (text: string) => setToast({ id: ++toastId, text, undoable: false }),
      undo: () => {
        const prev = past.current.pop();
        if (prev) {
          future.current.push({ d: current.current, parts: prev.parts });
          setData(restore(prev));
        }
        snapAt.current = 0;
        setHistoryTick((n) => n + 1);
        setToast(null);
      },
      redo: () => {
        const next = future.current.pop();
        if (next) {
          past.current.push({ d: current.current, parts: next.parts });
          setData(restore(next));
        }
        snapAt.current = 0;
        setHistoryTick((n) => n + 1);
        setToast(null);
      },
      dismissToast: () => setToast(null),
      undoable: (label: string, run: () => void) => {
        labelOverride.current = label;
        try {
          run();
        } finally {
          labelOverride.current = null;
        }
      },
    };
  }, [data, today, saveFailed, toast, apply]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
