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
  undo: () => void;
  dismissToast: () => void;
}

/** operations that can be undone for a few seconds, with the message to show */
const UNDOABLE: Record<string, string> = {
  deleteTask: 'Removed.',
  deleteOccurrence: 'Removed for that day.',
  moveOccurrence: 'Moved.',
  copyDay: "Copied. It's yours to adjust.",
  deleteRoutine: 'Routine removed.',
  applyTemplate: 'Template added.',
  splitOccurrence: 'Saved for just that day.',
  deleteTemplate: 'Template removed.',
};

const Ctx = createContext<Store | null>(null);
let toastId = 0;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const [today, setToday] = useState(todayISO());
  const [saveFailed, setSaveFailed] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const snap = useRef<AppData | null>(null);
  const snapAt = useRef(0);

  useEffect(() => {
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

  const apply = useCallback((fn: (d: AppData) => AppData, label?: string) => {
    setData((d) => {
      // several changes made together (e.g. Adjust My Day) share one undo
      if (label && Date.now() - snapAt.current > 1000) {
        snap.current = d;
        snapAt.current = Date.now();
      }
      return fn(d);
    });
    if (label) setToast({ id: ++toastId, text: label, undoable: true });
  }, []);

  const store = useMemo<Store>(() => {
    const w: Record<string, unknown> = {};
    for (const [name, fn] of Object.entries(ops)) {
      if (name === 'routineDay') continue;
      w[name] = (...args: unknown[]) =>
        apply((d) => (fn as (d: AppData, ...a: unknown[]) => AppData)(d, ...args), UNDOABLE[name]);
    }
    return {
      ...(w as unknown as Wrapped),
      data,
      today,
      saveFailed,
      toast,
      replaceAll: (d: AppData) => setData(d),
      resetSample: () => setData({ ...sampleData(), settings: data.settings }),
      resetEverything: () =>
        setData({ version: 1, tasks: [], routines: [], routineLog: {}, settings: { ...DEFAULT_SETTINGS }, blooms: 0, templates: [], counters: [], counterLog: {}, checkins: {} }),
      notify: (text: string) => setToast({ id: ++toastId, text, undoable: false }),
      undo: () => {
        if (snap.current) setData(snap.current);
        snap.current = null;
        setToast(null);
      },
      dismissToast: () => setToast(null),
    };
  }, [data, today, saveFailed, toast, apply]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
