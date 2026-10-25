import { sub } from './lib.mjs';

// ---- types
sub('src/lib/types.ts', "export interface RoutineStep {\n  id: string;\n  title: string;\n  minutes?: number;\n}",
`export interface RoutineStep {
  id: string;
  title: string;
  minutes?: number;
  /** kept on gentle days, when only the essentials are shown */
  essential?: boolean;
  /** a nice-to-have: never counts against finishing the routine */
  optional?: boolean;
  /** weekdays this step applies to (0 = Sunday); missing means every day the routine runs */
  days?: number[];
}`);
sub('src/lib/types.ts', "  days?: number[];\n}\n\nexport interface RoutineStep", "  days?: number[];\n  /** time (HH:MM) for a phone-calendar nudge when exported as .ics */\n  remindAt?: string;\n}\n\nexport interface RoutineStep");
sub('src/lib/types.ts', "  theme: 'light' | 'dark';", "  theme: 'light' | 'dark' | 'system';");
sub('src/lib/types.ts', "  /** hide the backup nudge until this ISO date */\n  backupSnooze?: string;",
`  /** hide the backup nudge until this ISO date */
  backupSnooze?: string;
  /** routines are resting from this date through pausedUntil (inclusive) */
  pausedFrom?: string;
  pausedUntil?: string;
  /** gentle (essentials-only) mode is on for this ISO date, and switches itself off the next day */
  gentleOn?: string;`);
sub('src/lib/types.ts', "export interface AppData {", `export interface Counter {
  id: string;
  label: string;
  icon: string;
  /** daily target; reaching it is a nice moment, never a requirement */
  goal: number;
}
export type Mood = 1 | 2 | 3 | 4 | 5;
export interface Checkin {
  mood?: Mood;
  note?: string;
}
export const MOODS: { id: Mood; icon: string; label: string }[] = [
  { id: 1, icon: '😔', label: 'Heavy' },
  { id: 2, icon: '😕', label: 'Low' },
  { id: 3, icon: '😐', label: 'Okay' },
  { id: 4, icon: '🙂', label: 'Good' },
  { id: 5, icon: '😊', label: 'Bright' },
];

export interface AppData {`);
sub('src/lib/types.ts', "  templates: Template[];\n}\n\nexport const DEFAULT", "  templates: Template[];\n  counters: Counter[];\n  /** date -> counter id -> count */\n  counterLog: Record<string, Record<string, number>>;\n  /** date -> how the day felt; private and optional */\n  checkins: Record<string, Checkin>;\n}\n\nexport const DEFAULT");

// ---- empty constructors
sub('src/lib/seed.ts', "    templates: [],", "    templates: [],\n    counters: [],\n    counterLog: {},\n    checkins: {},");
sub('src/test/helpers.ts', "  templates: [],", "  templates: [],\n  counters: [],\n  counterLog: {},\n  checkins: {},");
sub('src/store.tsx', "blooms: 0, templates: [] }", "blooms: 0, templates: [], counters: [], counterLog: {}, checkins: {} }");

// ---- validation
sub('src/lib/storage.ts', "!Array.isArray(r.steps) || !r.steps.every((s) => isObj(s) && isStr(s.id) && isStr(s.title))",
  "(r.remindAt !== undefined && !isTime(r.remindAt)) ||\n      !Array.isArray(r.steps) ||\n      !r.steps.every((s) => isObj(s) && isStr(s.id) && isStr(s.title) && (s.days === undefined || (Array.isArray(s.days) && s.days.every((x) => Number.isInteger(x) && x >= 0 && x <= 6))))");
sub('src/lib/storage.ts', "if (s.theme === 'light' || s.theme === 'dark') settings.theme = s.theme;", "if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'system') settings.theme = s.theme;");
sub('src/lib/storage.ts', "  let templates: Template[] = [];", `  if (isISODate(s.pausedFrom)) settings.pausedFrom = s.pausedFrom;
  if (isISODate(s.pausedUntil)) settings.pausedUntil = s.pausedUntil;
  if (isISODate(s.gentleOn)) settings.gentleOn = s.gentleOn;
  let counters: Counter[] = [];
  if (raw.counters !== undefined) {
    if (!Array.isArray(raw.counters) || !raw.counters.every((c) => isObj(c) && isStr(c.id) && isStr(c.label) && isStr(c.icon) && typeof c.goal === 'number' && c.goal > 0)) {
      return { ok: false, error: 'Counters in the file are malformed.' };
    }
    counters = raw.counters as Counter[];
  }
  const counterLog: AppData['counterLog'] = {};
  if (isObj(raw.counterLog)) {
    for (const [d, m] of Object.entries(raw.counterLog)) {
      if (!isISODate(d) || !isObj(m)) continue;
      const row: Record<string, number> = {};
      for (const [id, n] of Object.entries(m)) if (typeof n === 'number' && n >= 0) row[id] = n;
      counterLog[d] = row;
    }
  }
  const checkins: AppData['checkins'] = {};
  if (isObj(raw.checkins)) {
    for (const [d, c] of Object.entries(raw.checkins)) {
      if (!isISODate(d) || !isObj(c)) continue;
      const mood = c.mood;
      checkins[d] = {
        ...(typeof mood === 'number' && mood >= 1 && mood <= 5 ? { mood: Math.round(mood) as Mood } : {}),
        ...(isStr(c.note) && c.note ? { note: c.note } : {}),
      };
    }
  }
  let templates: Template[] = [];`);
sub('src/lib/storage.ts', "      templates,\n      version: 1,", "      templates,\n      counters,\n      counterLog,\n      checkins,\n      version: 1,");
sub('src/lib/storage.ts', "type AppData, type CategoryDef,", "type AppData, type CategoryDef, type Counter, type Mood,");

// ---- sync merge
sub('src/lib/sync.ts', "  const keys = [...settingsMap(local).keys()];", `  const counters = mergeMaps(base ? byId(base.counters) : new Map(), byId(local.counters), byId(remote.counters));
  const flatten = <T,>(d: AppData | null, pick: (x: AppData) => Record<string, Record<string, T>>) => {
    const m = new Map<string, T>();
    if (d) for (const [date, row] of Object.entries(pick(d))) for (const [id, v] of Object.entries(row)) m.set(date + '|' + id, v);
    return m;
  };
  const counts = mergeMaps(flatten(base, (x) => x.counterLog), flatten(local, (x) => x.counterLog), flatten(remote, (x) => x.counterLog), (l, r) => Math.max(l, r));
  const counterLog: AppData['counterLog'] = {};
  for (const [k, n] of counts) {
    const [date, id] = k.split('|');
    (counterLog[date] ??= {})[id] = n;
  }
  const checks = mergeMaps(new Map(Object.entries(base?.checkins ?? {})), new Map(Object.entries(local.checkins)), new Map(Object.entries(remote.checkins)));
  const keys = [...settingsMap(local).keys()];`);
sub('src/lib/sync.ts', "    templates: [...templates.values()],", "    templates: [...templates.values()],\n    counters: [...counters.values()],\n    counterLog,\n    checkins: Object.fromEntries(checks),");

// ---- theme 'system'
sub('src/store.tsx', "    document.documentElement.dataset.theme = data.settings.theme;\n  }, [data.settings.theme]);", `    const apply = () => {
      const dark = data.settings.theme === 'dark' || (data.settings.theme === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (data.settings.theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [data.settings.theme]);`);
sub('src/pages/Shed.tsx', "s.updateSettings({ theme: e.target.value as 'light' | 'dark' })}>\n              <option value=\"light\">Sunlit cream</option>", "s.updateSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}>\n              <option value=\"system\">Match my phone or computer</option>\n              <option value=\"light\">Sunlit cream</option>");
