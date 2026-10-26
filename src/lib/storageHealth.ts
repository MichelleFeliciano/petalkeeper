/** How full this browser's storage is, so there is a warning before saving starts to fail. */
export interface Health {
  /** 0 to 1 */
  ratio: number;
  /** a short description like "about 82% full" */
  text: string;
}

/** browsers keep roughly 5 million characters per web address in localStorage */
const LOCAL_LIMIT = 5_000_000;
export const WARN_AT = 0.7;

/** characters used by everything Petalkeeper keeps in this browser */
export function localUsage(): number {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) n += k.length + (localStorage.getItem(k)?.length ?? 0);
    }
  } catch {
    /* unreadable */
  }
  return n;
}

export async function storageHealth(): Promise<Health | null> {
  let ratio = localUsage() / LOCAL_LIMIT;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota && est.usage !== undefined) ratio = Math.max(ratio, est.usage / est.quota);
  } catch {
    /* estimate not supported: the saved-data size is still checked */
  }
  if (!Number.isFinite(ratio)) return null;
  return { ratio, text: `about ${Math.min(100, Math.round(ratio * 100))}% full` };
}
