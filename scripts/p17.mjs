import { readFileSync, writeFileSync } from 'node:fs';
import { sub, append } from './lib.mjs';

/* ================= storage: routine validator, salvage, fresh-sample flag, damaged-copy helpers ================= */
const ST = 'src/lib/storage.ts';
let s = readFileSync(ST, 'utf8').replace(/\r\n/g, '\n');
const a = s.indexOf('  for (const r of raw.routines) {');
const b = s.indexOf("  if (!isObj(raw.routineLog))");
if (a < 0 || b < 0) throw new Error('storage anchors');
s = s.slice(0, a) + "  if (!raw.routines.every(validRoutine)) return { ok: false, error: 'Some routines in the file are malformed.' };\n" + s.slice(b);
s = s.replace("export type ValidateResult =", `const dayList = (x: unknown) => Array.isArray(x) && x.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
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

export type ValidateResult =`);
s = s.replace("export function loadData(): AppData {", `/** true when this open started from the built-in examples because nothing had been saved yet */
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

export function loadData(): AppData {`);
s = s.replace("  if (text === null) return sampleData();", "  if (text === null) {\n    freshSample = true;\n    return sampleData();\n  }");
writeFileSync(ST, s.replace(/\n/g, s.includes('\r\n') ? '\r\n' : '\n'));

/* ================= sync: token expiry, kinder auth message, replace token ================= */
const SY = 'src/lib/sync.ts';
sub(SY, "  passphrase?: string;\n}", "  passphrase?: string;\n  /** the day the access token expires (you tell the app; GitHub doesn't share it), for a heads-up beforehand */\n  tokenExpires?: string;\n}");
sub(SY, "'GitHub did not accept that token. It may have expired or been mistyped.'", "'GitHub no longer accepts this token. It has probably expired or been removed. Make a new one at github.com/settings/personal-access-tokens, then use \"Replace token\" here. Your data on this device is safe.'");
append(SY, `
/** whole days until a date (negative once it has passed) */
export function daysLeft(expires: string | undefined, today: string): number | null {
  if (!expires || !/^\\d{4}-\\d{2}-\\d{2}$/.test(expires)) return null;
  const [y1, m1, d1] = expires.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000);
}
`);
const SX = 'src/sync.tsx';
sub(SX, "  connect: (repo: string, token: string, passphrase?: string) => Promise<'connected' | 'choose'>;", "  connect: (repo: string, token: string, passphrase?: string, expires?: string) => Promise<'connected' | 'choose'>;\n  /** swap in a new access token without disconnecting */\n  replaceToken: (token: string, expires?: string) => Promise<void>;\n  setTokenExpires: (expires: string | undefined) => void;");
sub(SX, "    connect: async (repo, token, passphrase) => {\n      const cfg: SyncConfig = { repo: repo.trim(), token: token.trim(), path: 'petalkeeper.json', auto: true, ...(passphrase?.trim() ? { passphrase: passphrase.trim() } : {}) };",
  "    connect: async (repo, token, passphrase, expires) => {\n      const cfg: SyncConfig = { repo: repo.trim(), token: token.trim(), path: 'petalkeeper.json', auto: true, ...(passphrase?.trim() ? { passphrase: passphrase.trim() } : {}), ...(expires ? { tokenExpires: expires } : {}) };");
sub(SX, "    cancelConnect: () => setPending(null),", `    cancelConnect: () => setPending(null),
    replaceToken: async (token, expires) => {
      if (!config) return;
      const { tokenExpires: _t, ...rest } = config;
      void _t;
      const next: SyncConfig = { ...rest, token: token.trim(), ...(expires ? { tokenExpires: expires } : {}) };
      await testConnection(next);
      saveSyncConfig(next);
      setConfig(next);
      setStatus('idle');
      setError('');
    },
    setTokenExpires: (expires) => {
      if (!config) return;
      const { tokenExpires: _t, ...rest } = config;
      void _t;
      const next: SyncConfig = expires ? { ...rest, tokenExpires: expires } : rest;
      saveSyncConfig(next);
      setConfig(next);
    },`);

/* ================= store: an undo that a button can ask for ================= */
const S2 = 'src/store.tsx';
sub(S2, "  dismissToast: () => void;\n}", "  dismissToast: () => void;\n  /** run an action and offer to undo it for a few seconds */\n  undoable: (label: string, run: () => void) => void;\n}");
sub(S2, "  const snapAt = useRef(0);\n", "  const snapAt = useRef(0);\n  const labelOverride = useRef<string | null>(null);\n");
sub(S2, "apply((d) => (fn as (d: AppData, ...a: unknown[]) => AppData)(d, ...args), UNDOABLE[name]);", "apply((d) => (fn as (d: AppData, ...a: unknown[]) => AppData)(d, ...args), labelOverride.current ?? UNDOABLE[name]);");
sub(S2, "      dismissToast: () => setToast(null),\n    };", "      dismissToast: () => setToast(null),\n      undoable: (label: string, run: () => void) => {\n        labelOverride.current = label;\n        try {\n          run();\n        } finally {\n          labelOverride.current = null;\n        }\n      },\n    };");

/* ================= small helpers ================= */
append('src/lib/journal.ts', `
/** one step per line; bullets and numbers at the start of a line are dropped */
export function stepLines(text: string): string[] {
  return text
    .split(/\\r?\\n/)
    .map((l) => l.replace(/^\\s*(?:[-*•–]|\\d+[.)])\\s*/, '').trim())
    .filter(Boolean);
}
`);
write('src/lib/useAutosave.ts', `import { useEffect, useRef } from 'react';

/** Saves a text value shortly after typing stops, when the page is hidden, and when the field goes away. */
export function useAutosave(value: string, saved: string, save: (v: string) => void, delay = 800) {
  const latest = useRef({ value, saved, save });
  latest.current = { value, saved, save };
  useEffect(() => {
    if (value === saved) return;
    const t = setTimeout(() => save(value), delay);
    return () => clearTimeout(t);
  }, [value, saved, delay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const flush = () => {
      const c = latest.current;
      if (c.value !== c.saved) c.save(c.value);
    };
    const hidden = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      flush();
    };
  }, []);
}
`);
function write(f, t) { writeFileSync(f, t); }
