import { sub } from './lib.mjs';
const SY = 'src/lib/sync.ts';

sub(SY, "  path: string;\n  auto: boolean;\n}", "  path: string;\n  auto: boolean;\n  /** if set, the cloud copy is encrypted with this passphrase (kept only in this browser) */\n  passphrase?: string;\n}");
sub(SY, "export type SyncErrorKind = 'auth' | 'notfound' | 'conflict' | 'network' | 'invalid' | 'other';", "export type SyncErrorKind = 'auth' | 'notfound' | 'conflict' | 'network' | 'invalid' | 'locked' | 'other';");

// ---- encryption helpers (inserted before the GitHub contents API section)
sub(SY, "/* ---------- GitHub contents API ---------- */", `/* ---------- optional end-to-end encryption (AES-GCM, key from a passphrase) ---------- */

const b64 = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const keyCache = new Map<string, CryptoKey>();
const saltFor = new Map<string, string>();

async function deriveKey(pass: string, saltB64: string): Promise<CryptoKey> {
  const id = pass + '|' + saltB64;
  const hit = keyCache.get(id);
  if (hit) return hit;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new SyncError('invalid', "This browser can't do encryption.");
  const base = await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: 150_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  keyCache.set(id, key);
  return key;
}

interface Wrapper {
  'petalkeeper-encrypted': 1;
  salt: string;
  iv: string;
  data: string;
}
export async function encryptText(text: string, pass: string): Promise<string> {
  let salt = saltFor.get(pass);
  if (!salt) {
    salt = b64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
    saltFor.set(pass, salt);
  }
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  const w: Wrapper = { 'petalkeeper-encrypted': 1, salt, iv: b64(iv), data: b64(new Uint8Array(ct)) };
  return JSON.stringify(w);
}
export async function decryptText(w: Wrapper, pass: string): Promise<string> {
  try {
    const key = await deriveKey(pass, w.salt);
    const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(w.iv) }, key, unb64(w.data));
    saltFor.set(pass, w.salt);
    return new TextDecoder().decode(pt);
  } catch (e) {
    if (e instanceof SyncError) throw e;
    throw new SyncError('locked', "That passphrase doesn't open the cloud copy.");
  }
}
const isWrapper = (x: unknown): x is Wrapper => typeof x === 'object' && x !== null && (x as Record<string, unknown>)['petalkeeper-encrypted'] === 1;

/* ---------- GitHub contents API ---------- */`);

// ---- getRemote with optional ref and decryption
sub(SY, "export async function getRemote(c: SyncConfig, f: Fetch = fetch): Promise<Remote> {\n  const res = await call(f, c, url(c, `/contents/${encodeURIComponent(c.path)}`));",
  "export async function getRemote(c: SyncConfig, f: Fetch = fetch, ref?: string): Promise<Remote> {\n  const res = await call(f, c, url(c, `/contents/${encodeURIComponent(c.path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`));");
sub(SY, "  let parsed: unknown;\n  try {\n    parsed = JSON.parse(dec(body.content));\n  } catch {", `  let parsed: unknown;
  try {
    parsed = JSON.parse(dec(body.content));
    if (isWrapper(parsed)) {
      if (!c.passphrase) throw new SyncError('locked', 'This cloud copy is encrypted. Enter your passphrase to connect.');
      parsed = JSON.parse(await decryptText(parsed, c.passphrase));
    }
  } catch (e) {
    if (e instanceof SyncError) throw e;`);

// ---- putRemote encrypts when a passphrase is set
sub(SY, "    body: JSON.stringify({ message: 'Petalkeeper sync', content: enc(exportJSON(data)), ...(sha ? { sha } : {}) }),",
  "    body: JSON.stringify({ message: 'Petalkeeper sync', content: enc(c.passphrase ? await encryptText(exportJSON(data), c.passphrase) : exportJSON(data)), ...(sha ? { sha } : {}) }),");

// ---- pushReplace without needing to read/decrypt the old file; version history
sub(SY, "export async function pushReplace(c: SyncConfig, local: AppData, f: Fetch = fetch): Promise<void> {\n  const remote = await getRemote(c, f);\n  await putRemote(c, forCloud(local), remote.sha, f);\n}", `/** just the current file's id, so it can be replaced even if it can't be read (for example after changing the passphrase) */
export async function remoteSha(c: SyncConfig, f: Fetch = fetch): Promise<string | undefined> {
  const res = await call(f, c, url(c, \`/contents/\${encodeURIComponent(c.path)}\`));
  if (res.status === 404) return undefined;
  if (!res.ok) throw failFrom(res);
  return ((await res.json()) as { sha?: string }).sha;
}

export async function pushReplace(c: SyncConfig, local: AppData, f: Fetch = fetch): Promise<void> {
  await putRemote(c, forCloud(local), await remoteSha(c, f), f);
}

export interface Version {
  sha: string;
  date: string;
}
/** the saved versions of the cloud file, newest first (GitHub keeps every sync) */
export async function listVersions(c: SyncConfig, f: Fetch = fetch): Promise<Version[]> {
  const res = await call(f, c, url(c, \`/commits?path=\${encodeURIComponent(c.path)}&per_page=30\`));
  if (!res.ok) throw failFrom(res);
  const rows = (await res.json()) as { sha: string; commit?: { committer?: { date?: string }; author?: { date?: string } } }[];
  return rows.map((r) => ({ sha: r.sha, date: r.commit?.committer?.date ?? r.commit?.author?.date ?? '' }));
}
export async function getVersion(c: SyncConfig, sha: string, f: Fetch = fetch): Promise<AppData> {
  const r = await getRemote(c, f, sha);
  if (!r.data) throw new SyncError('notfound', 'That version could not be found.');
  return r.data;
}`);
