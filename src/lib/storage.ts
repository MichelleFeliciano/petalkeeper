import { isISODate, isTime } from './dates';
import { sampleData } from './seed';
import { DEFAULT_SETTINGS, PARTS, type AppData, type CategoryDef, type Settings, type Task, type Template } from './types';

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
  if (!Array.isArray(t.subtasks) || !t.subtasks.every((s) => isObj(s) && isStr(s.id) && isStr(s.title) && typeof s.done === 'boolean')) return false;
  if (!Array.isArray(t.completions) || !t.completions.every(isISODate)) return false;
  if (!Array.isArray(t.skipped) || !t.skipped.every(isISODate)) return false;
  if (!isObj(t.subDone)) return false;
  if (t.recurrence !== undefined) {
    const r = t.recurrence as unknown;
    if (!isObj(r) || !['daily', 'days', 'weekly', 'monthly'].includes(r.freq as string)) return false;
    if (r.until !== undefined && !isISODate(r.until)) return false;
    if (r.days !== undefined && !(Array.isArray(r.days) && r.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) return false;
  }
  return true;
}

export type ValidateResult = { ok: true; data: AppData } | { ok: false; error: string };

/** Returns a cleaned AppData or an error message. Never throws. */
export function validateData(raw: unknown): ValidateResult {
  if (!isObj(raw)) return { ok: false, error: 'That file is not a Petalkeeper backup.' };
  if (raw.version !== 1) return { ok: false, error: 'Unsupported backup version.' };
  if (!Array.isArray(raw.tasks) || !raw.tasks.every(validTask)) return { ok: false, error: 'Some tasks in the file are malformed.' };
  if (!Array.isArray(raw.routines)) return { ok: false, error: 'Routines are missing or malformed.' };
  for (const r of raw.routines) {
    if (
      !isObj(r) || !isStr(r.id) || !isStr(r.name) || !PARTS.some((p) => p.id === r.kind) ||
      !Array.isArray(r.steps) || !r.steps.every((s) => isObj(s) && isStr(s.id) && isStr(s.title))
    ) {
      return { ok: false, error: 'Some routines in the file are malformed.' };
    }
  }
  if (!isObj(raw.routineLog)) return { ok: false, error: 'Routine history is malformed.' };
  if (!isObj(raw.settings)) return { ok: false, error: 'Settings are malformed.' };
  const s = raw.settings as Partial<Settings>;
  const settings: Settings = { ...DEFAULT_SETTINGS };
  if (s.weekStart === 0 || s.weekStart === 1) settings.weekStart = s.weekStart;
  if (typeof s.defaultDuration === 'number' && s.defaultDuration > 0) settings.defaultDuration = s.defaultDuration;
  if (typeof s.buffer === 'number' && s.buffer >= 0) settings.buffer = s.buffer;
  if (s.theme === 'light' || s.theme === 'dark') settings.theme = s.theme;
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
  if (isISODate(s.lastBackup)) settings.lastBackup = s.lastBackup;
  if (isISODate(s.backupSnooze)) settings.backupSnooze = s.backupSnooze;
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
      version: 1,
      tasks: raw.tasks as Task[],
      routines: raw.routines as AppData['routines'],
      routineLog: raw.routineLog as AppData['routineLog'],
      settings,
      blooms: typeof raw.blooms === 'number' && raw.blooms >= 0 ? raw.blooms : 0,
    },
  };
}

export function loadData(): AppData {
  let text: string | null = null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch {
    return sampleData();
  }
  if (text === null) return sampleData();
  try {
    const res = validateData(JSON.parse(text));
    if (res.ok) return res.data;
  } catch {
    /* fall through */
  }
  // Corrupted: keep a copy of the raw text so nothing is silently lost.
  try {
    localStorage.setItem(STORAGE_KEY + '.corrupt', text);
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

export function exportJSON(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function parseImport(text: string): ValidateResult {
  try {
    return validateData(JSON.parse(text));
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
}
