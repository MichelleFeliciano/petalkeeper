import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadData, saveData } from './lib/storage';
import { sampleData } from './lib/seed';
import { DEFAULT_SETTINGS, type AppData } from './lib/types';
import * as ops from './lib/ops';
import { todayISO } from './lib/dates';

type Fn<A extends unknown[]> = (...a: A) => void;
type Tail<F> = F extends (d: AppData, ...rest: infer R) => AppData ? Fn<R> : never;

type Wrapped = { [K in keyof typeof ops as (typeof ops)[K] extends (d: AppData, ...r: never[]) => AppData ? K : never]: Tail<(typeof ops)[K]> };

export interface Store extends Wrapped {
  data: AppData;
  today: string;
  saveFailed: boolean;
  replaceAll: (d: AppData) => void;
  resetSample: () => void;
  resetEverything: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const [today, setToday] = useState(todayISO());
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!saveData(data));
  }, [data]);

  // Roll over to the new day while the app is left open.
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);

  const apply = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);

  const store = useMemo<Store>(() => {
    const w: Record<string, unknown> = {};
    for (const [name, fn] of Object.entries(ops)) {
      if (name === 'routineDay') continue;
      w[name] = (...args: unknown[]) => apply((d) => (fn as (d: AppData, ...a: unknown[]) => AppData)(d, ...args));
    }
    return {
      ...(w as unknown as Wrapped),
      data,
      today,
      saveFailed,
      replaceAll: (d: AppData) => setData(d),
      resetSample: () => setData({ ...sampleData(), settings: data.settings }),
      resetEverything: () =>
        setData({ version: 1, tasks: [], routines: [], routineLog: {}, settings: { ...DEFAULT_SETTINGS }, blooms: 0 }),
    };
  }, [data, today, saveFailed, apply]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
