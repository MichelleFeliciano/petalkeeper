import { exportJSON, validateData } from './storage';
import type { AppData, RoutineDay } from './types';

/**
 * Sync between devices through a PRIVATE GitHub repository you own.
 * No third-party service, no server of ours. The token lives only in this browser.
 * Merging is three-way (last synced copy, this device, the cloud copy) so edits made
 * on two devices are combined instead of one overwriting the other.
 */

export interface SyncConfig {
  /** "owner/name" of the private data repo */
  repo: string;
  token: string;
  path: string;
  auto: boolean;
}

export type SyncErrorKind = 'auth' | 'notfound' | 'conflict' | 'network' | 'invalid' | 'other';
export class SyncError extends Error {
  constructor(public kind: SyncErrorKind, message: string) {
    super(message);
  }
}

type Fetch = typeof fetch;

/* ---------- local storage of sync settings (kept out of backups on purpose) ---------- */

const CFG_KEY = 'petalkeeper.sync';
const BASE_KEY = 'petalkeeper.sync.base';

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (typeof c.repo === 'string' && typeof c.token === 'string') return { path: 'petalkeeper.json', auto: true, ...c };
  } catch {
    /* ignore */
  }
  return null;
}
export function saveSyncConfig(c: SyncConfig | null) {
  try {
    if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CFG_KEY);
  } catch {
    /* ignore */
  }
}
export function loadBase(): AppData | null {
  try {
    const raw = localStorage.getItem(BASE_KEY);
    if (!raw) return null;
    const r = validateData(JSON.parse(raw));
    return r.ok ? r.data : null;
  } catch {
    return null;
  }
}
export function saveBase(d: AppData | null) {
  try {
    if (d) localStorage.setItem(BASE_KEY, JSON.stringify(d));
    else localStorage.removeItem(BASE_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------- comparing and merging ---------- */

/** JSON with sorted keys, so equal data always compares equal */
export function stable(x: unknown): string {
  return JSON.stringify(x, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}
const eq = (a: unknown, b: unknown) => stable(a) === stable(b);
/** the copy stored in the cloud never carries per-device settings */
export const forCloud = (d: AppData): AppData => ({ ...d, settings: { ...d.settings, notifications: false } });

function mergeMaps<T>(
  base: Map<string, T>,
  local: Map<string, T>,
  remote: Map<string, T>,
  onConflict: (l: T, r: T) => T = (l) => l,
): Map<string, T> {
  const out = new Map<string, T>();
  const keys = [...local.keys(), ...[...remote.keys()].filter((k) => !local.has(k))];
  for (const k of keys) {
    const b = base.get(k);
    const l = local.get(k);
    const r = remote.get(k);
    if (l !== undefined && r !== undefined) {
      if (eq(l, r)) out.set(k, l);
      else if (b !== undefined && eq(b, l)) out.set(k, r); // only the cloud changed it
      else if (b !== undefined && eq(b, r)) out.set(k, l); // only this device changed it
      else out.set(k, onConflict(l, r)); // both changed it
    } else if (l !== undefined) {
      // gone from the cloud: a deletion, unless this device edited it since
      if (b === undefined || !eq(b, l)) out.set(k, l);
    } else if (r !== undefined) {
      // gone from this device: a deletion, unless the cloud edited it since
      if (b === undefined || !eq(b, r)) out.set(k, r);
    }
  }
  return out;
}

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

function flattenLog(d: AppData | null): Map<string, RoutineDay> {
  const m = new Map<string, RoutineDay>();
  if (!d) return m;
  for (const [date, rs] of Object.entries(d.routineLog)) for (const [rid, day] of Object.entries(rs)) m.set(`${date}|${rid}`, day);
  return m;
}

const settingsMap = (d: AppData | null) => new Map<string, unknown>(d ? Object.entries(d.settings) : []);

/** Settings that only make sense on one device */
const LOCAL_ONLY = new Set(['notifications']);

/** Three-way merge. `base` is the copy both devices last agreed on (null on first sync). */
export function mergeData(base: AppData | null, local: AppData, remote: AppData): AppData {
  const tasks = mergeMaps(base ? byId(base.tasks) : new Map(), byId(local.tasks), byId(remote.tasks));
  const routines = mergeMaps(base ? byId(base.routines) : new Map(), byId(local.routines), byId(remote.routines));
  const templates = mergeMaps(base ? byId(base.templates) : new Map(), byId(local.templates), byId(remote.templates));
  const log = mergeMaps(flattenLog(base), flattenLog(local), flattenLog(remote), (l, r) => {
    const done = [...new Set([...l.done, ...r.done])];
    return { done, skipped: [...new Set([...l.skipped, ...r.skipped])].filter((s) => !done.includes(s)) };
  });
  const routineLog: AppData['routineLog'] = {};
  for (const [k, day] of log) {
    const [date, rid] = k.split('|');
    (routineLog[date] ??= {})[rid] = day;
  }
  const keys = [...settingsMap(local).keys()];
  const sm = mergeMaps(settingsMap(base), settingsMap(local), settingsMap(remote));
  const settings = { ...local.settings } as unknown as Record<string, unknown>;
  for (const k of keys) if (!LOCAL_ONLY.has(k) && sm.has(k)) settings[k] = sm.get(k);
  // optional settings that were cleared on one side
  return {
    version: 1,
    tasks: [...tasks.values()],
    routines: [...routines.values()],
    templates: [...templates.values()],
    routineLog,
    settings: settings as unknown as AppData['settings'],
    blooms: Math.max(local.blooms, remote.blooms),
  };
}

/* ---------- GitHub contents API ---------- */

const enc = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};
const dec = (b64: string) => {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

function url(c: SyncConfig, suffix = '') {
  const [owner, name] = c.repo.split('/');
  return `https://api.github.com/repos/${owner}/${name}${suffix}`;
}

async function call(f: Fetch, c: SyncConfig, u: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await f(u, {
      cache: 'no-store',
      ...init,
      headers: {
        Authorization: `Bearer ${c.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new SyncError('network', "Couldn't reach GitHub. Check your connection and try again.");
  }
  return res;
}

function failFrom(res: Response): SyncError {
  if (res.status === 401) return new SyncError('auth', 'GitHub did not accept that token. It may have expired or been mistyped.');
  if (res.status === 403) return new SyncError('auth', 'GitHub refused access. Check the token has Contents read and write for the data repository.');
  if (res.status === 404) return new SyncError('notfound', "Couldn't find that repository. Check its name and that the token can access it.");
  if (res.status === 409 || res.status === 422) return new SyncError('conflict', 'The cloud copy changed while syncing.');
  return new SyncError('other', `GitHub returned an error (${res.status}).`);
}

/** Check the token can reach the repo. */
export async function testConnection(c: SyncConfig, f: Fetch = fetch): Promise<void> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(c.repo)) throw new SyncError('invalid', 'Enter the repository as owner/name, for example jane/petalkeeper-data.');
  if (!c.token.trim()) throw new SyncError('invalid', 'Paste your access token first.');
  const res = await call(f, c, url(c));
  if (!res.ok) throw failFrom(res);
  const info = (await res.json()) as { private?: boolean };
  if (info.private === false) throw new SyncError('invalid', 'That repository is public. Please use a private repository so your schedule stays private.');
}

export interface Remote {
  data: AppData | null;
  sha?: string;
}

export async function getRemote(c: SyncConfig, f: Fetch = fetch): Promise<Remote> {
  const res = await call(f, c, url(c, `/contents/${encodeURIComponent(c.path)}`));
  if (res.status === 404) {
    // 404 can mean "no such file yet" or "no such repo"; the second was ruled out by testConnection
    return { data: null };
  }
  if (!res.ok) throw failFrom(res);
  const body = (await res.json()) as { content?: string; sha?: string };
  if (!body.content) throw new SyncError('invalid', 'The cloud file is empty.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(dec(body.content));
  } catch {
    throw new SyncError('invalid', 'The cloud file is not valid Petalkeeper data. Nothing was changed.');
  }
  const v = validateData(parsed);
  if (!v.ok) throw new SyncError('invalid', `The cloud file could not be read (${v.error}) Nothing was changed.`);
  return { data: v.data, sha: body.sha };
}

export async function putRemote(c: SyncConfig, data: AppData, sha: string | undefined, f: Fetch = fetch): Promise<string> {
  const res = await call(f, c, url(c, `/contents/${encodeURIComponent(c.path)}`), {
    method: 'PUT',
    body: JSON.stringify({ message: 'Petalkeeper sync', content: enc(exportJSON(data)), ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw failFrom(res);
  const body = (await res.json()) as { content?: { sha?: string } };
  return body.content?.sha ?? '';
}

export interface SyncResult {
  merged: AppData;
  /** true if the cloud copy was updated */
  pushed: boolean;
}

/** Pull, merge three ways, push if anything changed. Retries if the cloud copy moved underneath us. */
export async function runSync(c: SyncConfig, local: AppData, base: AppData | null, f: Fetch = fetch): Promise<SyncResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await getRemote(c, f);
    const merged = remote.data ? mergeData(base, local, remote.data) : local;
    if (remote.data && eq(forCloud(merged), forCloud(remote.data))) return { merged, pushed: false };
    try {
      await putRemote(c, forCloud(merged), remote.sha, f);
      return { merged, pushed: true };
    } catch (e) {
      if (e instanceof SyncError && e.kind === 'conflict') continue;
      throw e;
    }
  }
  throw new SyncError('conflict', 'The cloud copy kept changing. Please try again in a moment.');
}

/** Replace the cloud copy with this device's data. */
export async function pushReplace(c: SyncConfig, local: AppData, f: Fetch = fetch): Promise<void> {
  const remote = await getRemote(c, f);
  await putRemote(c, forCloud(local), remote.sha, f);
}
