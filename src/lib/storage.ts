import { isISODate, isTime } from './dates';
import { sampleData } from './seed';
import { DEFAULT_SETTINGS, PARTS, type AppData, type CategoryDef, type Counter, type Countdown, type Mood, type Needed, type Place, type PlannedPause, type Stay, type Settings, type Task, type Template } from './types';

export const STORAGE_KEY = 'petalkeeper.v1';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const optDate = (v: unknown) => v === undefined || isISODate(v);
const optTime = (v: unknown) => v === undefined || isTime(v);

function validTask(t: unknown): t is Task {
  if (!isObj(t)) return false;
  if (!isStr(t.id) || !isStr(t.title) || !isStr(t.notes)) return false;
  if (!isStr(t.category) || !t.category) return false;
  if (!['low', 'normal', 'high'].includes(t.priority as string)) return false;
  if (!optDate(t.date) || !optDate(t.due) || !optTime(t.start) || !optTime(t.end)) return false;
  if (t.duration !== undefined && (typeof t.duration !== 'number' || t.duration < 0)) return false;
  if (typeof t.done !== 'boolean' || !isStr(t.createdAt)) return false;
  if (t.order !== undefined && (typeof t.order !== 'number' || !Number.isFinite(t.order))) return false;
  if (!Array.isArray(t.subtasks) || !t.subtasks.every((s) => isObj(s) && isStr(s.id) && isStr(s.title) && typeof s.done === 'boolean')) return false;
  if (!Array.isArray(t.completions) || !t.completions.every(isISODate)) return false;
  if (!Array.isArray(t.skipped) || !t.skipped.every(isISODate)) return false;
  if (!isObj(t.subDone)) return false;
  if (t.recurrence !== undefined) {
    const r = t.recurrence as unknown;
    if (!isObj(r) || !['daily', 'days', 'weekly', 'monthly'].includes(r.freq as string)) return false;
    if (r.until !== undefined && !isISODate(r.until)) return false;
    if (r.dom !== undefined && !(Number.isInteger(r.dom) && (r.dom as number) >= 1 && (r.dom as number) <= 31)) return false;
    if (r.days !== undefined && !(Array.isArray(r.days) && r.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) return false;
  }
  return true;
}

const dayList = (x: unknown) => Array.isArray(x) && x.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
function validRoutine(r: unknown): boolean {
  if (!isObj(r) || !isStr(r.id) || !isStr(r.name) || !PARTS.some((p) => p.id === r.kind)) return false;
  if (r.days !== undefined && !dayList(r.days)) return false;
  if (r.remindAt !== undefined && !isTime(r.remindAt)) return false;
  if (r.places !== undefined && !(Array.isArray(r.places) && r.places.every(isStr))) return false;
  if (!Array.isArray(r.steps)) return false;
  return r.steps.every(
    (st) =>
      isObj(st) && isStr(st.id) && isStr(st.title) && (st.days === undefined || dayList(st.days)) && (st.note === undefined || isStr(st.note)) &&
      (st.places === undefined || (Array.isArray(st.places) && st.places.every(isStr))),
  );
}

export type ValidateResult = { ok: true; data: AppData } | { ok: false; error: string };

/** Returns a cleaned AppData or an error message. Never throws. */
export function validateData(raw: unknown): ValidateResult {
  if (!isObj(raw)) return { ok: false, error: 'That file is not a Petalkeeper backup.' };
  if (raw.version !== 1) return { ok: false, error: 'Unsupported backup version.' };
  if (!Array.isArray(raw.tasks) || !raw.tasks.every(validTask)) return { ok: false, error: 'Some tasks in the file are malformed.' };
  if (!Array.isArray(raw.routines)) return { ok: false, error: 'Routines are missing or malformed.' };
  if (!raw.routines.every(validRoutine)) return { ok: false, error: 'Some routines in the file are malformed.' };
  if (!isObj(raw.routineLog)) return { ok: false, error: 'Routine history is malformed.' };
  if (!isObj(raw.settings)) return { ok: false, error: 'Settings are malformed.' };
  const routineLog: AppData['routineLog'] = {};
  for (const [date, rs] of Object.entries(raw.routineLog)) {
    if (!isISODate(date) || !isObj(rs)) continue;
    const row: AppData['routineLog'][string] = {};
    for (const [rid, day] of Object.entries(rs)) {
      if (!isObj(day)) continue;
      row[rid] = {
        done: Array.isArray(day.done) ? day.done.filter(isStr) : [],
        skipped: Array.isArray(day.skipped) ? day.skipped.filter(isStr) : [],
        ...(isStr(day.start) ? { start: day.start } : {}),
        ...(isStr(day.end) ? { end: day.end } : {}),
      };
    }
    routineLog[date] = row;
  }
  const s = raw.settings as Partial<Settings>;
  const settings: Settings = { ...DEFAULT_SETTINGS };
  if (s.weekStart === 0 || s.weekStart === 1) settings.weekStart = s.weekStart;
  if (typeof s.defaultDuration === 'number' && s.defaultDuration > 0) settings.defaultDuration = s.defaultDuration;
  if (typeof s.buffer === 'number' && s.buffer >= 0) settings.buffer = s.buffer;
  if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'system') settings.theme = s.theme;
  if (s.defaultPage && ['today', 'rituals', 'path', 'seeds'].includes(s.defaultPage)) settings.defaultPage = s.defaultPage;
  if (typeof s.showFairy === 'boolean') settings.showFairy = s.showFairy;
  if (typeof s.showGarden === 'boolean') settings.showGarden = s.showGarden;
  if (typeof s.notifications === 'boolean') settings.notifications = s.notifications;
  if (typeof s.notifyLead === 'number' && s.notifyLead >= 0) settings.notifyLead = s.notifyLead;
  if (s.decor && ['blooms', 'mushrooms', 'butterflies', 'stars'].includes(s.decor)) settings.decor = s.decor;
  if (Array.isArray(s.customCategories)) {
    settings.customCategories = (s.customCategories as unknown[]).filter(
      (c): c is CategoryDef => isObj(c) && isStr(c.id) && isStr(c.label) && isStr(c.icon) && (c.color === undefined || isStr(c.color)),
    );
  }
  if (isTime(s.todoRemindAt)) settings.todoRemindAt = s.todoRemindAt;
  if (isISODate(s.lastBackup)) settings.lastBackup = s.lastBackup;
  if (isISODate(s.backupSnooze)) settings.backupSnooze = s.backupSnooze;
  if (isISODate(s.pausedFrom)) settings.pausedFrom = s.pausedFrom;
  if (isISODate(s.pausedUntil)) settings.pausedUntil = s.pausedUntil;
  if (isISODate(s.gentleOn)) settings.gentleOn = s.gentleOn;
  if (Array.isArray(s.plannedPauses)) {
    settings.plannedPauses = (s.plannedPauses as unknown[]).filter(
      (p): p is PlannedPause => isObj(p) && isStr(p.id) && isISODate(p.from) && isISODate(p.until),
    );
  }
  if (Array.isArray(s.places)) {
    const ps = (s.places as unknown[]).filter((p): p is Place => isObj(p) && isStr(p.id) && isStr(p.label) && isStr(p.icon));
    if (ps.length > 0) settings.places = ps;
  }
  if (isStr(s.place) && settings.places.some((p) => p.id === s.place)) settings.place = s.place;
  else settings.place = settings.places[0].id;
  if (Array.isArray(s.stays)) {
    settings.stays = (s.stays as unknown[]).filter((p): p is Stay => isObj(p) && isStr(p.id) && isStr(p.place) && isISODate(p.from) && isISODate(p.until));
  }
  let needed: Needed[] = [];
  if (raw.needed !== undefined) {
    if (!Array.isArray(raw.needed) || !raw.needed.every((n) => isObj(n) && isStr(n.id) && isStr(n.label) && isStr(n.icon))) {
      return { ok: false, error: 'As-needed items in the file are malformed.' };
    }
    needed = raw.needed as Needed[];
  }
  const neededLog: AppData['neededLog'] = {};
  if (isObj(raw.neededLog)) {
    for (const [id, v] of Object.entries(raw.neededLog)) if (Array.isArray(v)) neededLog[id] = v.filter(isStr).slice(-50);
  }
  let countdowns: Countdown[] = [];
  if (raw.countdowns !== undefined) {
    if (!Array.isArray(raw.countdowns) || !raw.countdowns.every((c) => isObj(c) && isStr(c.id) && isStr(c.label) && isStr(c.icon) && isISODate(c.date))) {
      return { ok: false, error: 'Countdowns in the file are malformed.' };
    }
    countdowns = raw.countdowns as Countdown[];
  }
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
  let templates: Template[] = [];
  if (raw.templates !== undefined) {
    if (
      !Array.isArray(raw.templates) ||
      !raw.templates.every((t) => isObj(t) && isStr(t.id) && isStr(t.name) && Array.isArray(t.items) && t.items.every((i) => isObj(i) && isStr(i.title) && isStr(i.category)))
    ) {
      return { ok: false, error: 'Templates in the file are malformed.' };
    }
    templates = raw.templates as Template[];
  }
  return {
    ok: true,
    data: {
      templates,
      needed,
      neededLog,
      countdowns,
      counters,
      counterLog,
      checkins,
      version: 1,
      tasks: raw.tasks as Task[],
      routines: raw.routines as AppData['routines'],
      routineLog,
      settings,
      blooms: typeof raw.blooms === 'number' && raw.blooms >= 0 ? raw.blooms : 0,
    },
  };
}

/** true when this open started from the built-in examples because nothing had been saved yet */
let freshSample = false;
export const isFreshSample = () => freshSample;

/** Keep what can be read from damaged saved data: drop the broken pieces instead of everything. */
export function salvage(text: string): AppData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw)) return null;
  const list = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as unknown[]) : []);
  const cand: Obj = {
    ...raw,
    version: 1,
    tasks: list('tasks').filter(validTask),
    routines: list('routines').filter(validRoutine),
    routineLog: isObj(raw.routineLog) ? raw.routineLog : {},
    settings: isObj(raw.settings) ? raw.settings : {},
  };
  const first = validateData(cand);
  if (first.ok) return first.data;
  // optional parts that can't be read are simply left out
  const optional = ['templates', 'counters', 'needed', 'countdowns'];
  const without = (keys: string[]) => Object.fromEntries(Object.entries(cand).filter(([k]) => !keys.includes(k)));
  for (const keys of [...optional.map((k) => [k]), optional]) {
    const r = validateData(without(keys));
    if (r.ok) return r.data;
  }
  return null;
}

const CORRUPT_KEY = STORAGE_KEY + '.corrupt';
export const corruptCopy = (): string | null => {
  try {
    return localStorage.getItem(CORRUPT_KEY);
  } catch {
    return null;
  }
};
export const clearCorruptCopy = () => {
  try {
    localStorage.removeItem(CORRUPT_KEY);
  } catch {
    /* ignore */
  }
};

export function loadData(): AppData {
  let text: string | null = null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch {
    return sampleData();
  }
  if (text === null) {
    freshSample = true;
    return sampleData();
  }
  try {
    const res = validateData(JSON.parse(text));
    if (res.ok) return res.data;
  } catch {
    /* fall through */
  }
  // Corrupted: keep a copy of the raw text so nothing is silently lost.
  try {
    // keep the first damaged copy; don't overwrite it with a later one
    if (localStorage.getItem(STORAGE_KEY + '.corrupt') === null) localStorage.setItem(STORAGE_KEY + '.corrupt', text);
  } catch {
    /* ignore */
  }
  return sampleData();
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** `version` is the file format. The app name, app version and date say where the file came from. */
export function exportJSON(data: AppData): string {
  return JSON.stringify({ app: 'petalkeeper', appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined, exportedAt: new Date().toISOString(), ...data }, null, 2);
}

export function parseImport(text: string): ValidateResult {
  try {
    return validateData(JSON.parse(text));
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
}
