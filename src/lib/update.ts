/** Checking for and installing a newer published version of the app. */
export interface Published {
  version: string;
  build: string;
}

export const prettyDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const versionLabel = (v: string, build: string) => `v${v} (${prettyDate(build)})`;
/** the name of the offline copy; the build writes the same name into the service worker */
export const CACHE_NAME = `petalkeeper-v${__APP_VERSION__}`;

/** what is published right now, or null when it can't be reached (offline) */
export async function fetchLatest(): Promise<Published | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.build === 'string' ? { version: String(j.version), build: j.build } : null;
  } catch {
    return null;
  }
}

export const isNewer = (p: Published | null) => !!p && p.build !== __APP_BUILD__;

/** drop the old offline copy and reload so the new files are fetched. Saved data is never touched. */
export async function applyUpdate(pauseMs = 1200) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* unsupported: a plain reload still fetches the new files */
  }
  await new Promise((r) => setTimeout(r, pauseMs));
  location.reload();
}

/* what's new: remember which version this device last showed notes for */
const SEEN_KEY = 'petalkeeper.seenVersion';
export const seenVersion = (): string | null => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};
export const markSeenVersion = (v: string) => {
  try {
    localStorage.setItem(SEEN_KEY, v);
  } catch {
    /* ignore */
  }
};
