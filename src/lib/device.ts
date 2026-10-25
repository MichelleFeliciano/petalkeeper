/** Preferences that belong to one device and never sync: text size, the optional PIN, and whether the welcome tour was seen. */

const SIZE_KEY = 'petalkeeper.textsize';
const PIN_KEY = 'petalkeeper.pin';
const TOUR_KEY = 'petalkeeper.toured';

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export type TextSize = 'normal' | 'large' | 'xlarge';
export const getTextSize = (): TextSize => {
  const v = read(SIZE_KEY);
  return v === 'large' || v === 'xlarge' ? v : 'normal';
};
export function setTextSize(s: TextSize) {
  write(SIZE_KEY, s === 'normal' ? null : s);
  applyTextSize(s);
}
export const applyTextSize = (s: TextSize) => {
  document.documentElement.dataset.text = s;
};

export const tourSeen = () => read(TOUR_KEY) === '1';
export const markTourSeen = () => write(TOUR_KEY, '1');

/* A casual privacy lock, not encryption: it keeps someone who picks up your unlocked phone out of the app,
   but the data still sits in this browser's storage. */
function hash(pin: string, salt: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const s = salt + ':' + pin;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export const hasPin = () => read(PIN_KEY) !== null;
export function setPin(pin: string | null) {
  if (pin === null) return write(PIN_KEY, null);
  const salt = Math.random().toString(36).slice(2, 10);
  write(PIN_KEY, JSON.stringify({ salt, hash: hash(pin, salt) }));
}
export function checkPin(pin: string): boolean {
  try {
    const p = JSON.parse(read(PIN_KEY) ?? 'null');
    return !!p && p.hash === hash(pin, p.salt);
  } catch {
    return false;
  }
}
export const validPin = (pin: string) => /^\d{4,8}$/.test(pin);

/* weekly backup file (opt in, per device) */
const AB_KEY = 'petalkeeper.autobackup';
/** stored value: "off", or the ISO date of the last automatic backup ("on" before the first one) */
export const autoBackupOn = () => {
  const v = read(AB_KEY);
  return v !== null && v !== 'off';
};
export const setAutoBackup = (on: boolean) => write(AB_KEY, on ? 'on' : null);
export function autoBackupDue(today: string): boolean {
  const v = read(AB_KEY);
  if (v === null || v === 'off') return false;
  if (v === 'on') return true;
  return (new Date(today).getTime() - new Date(v).getTime()) / 86_400_000 >= 7;
}
export const markAutoBackup = (today: string) => write(AB_KEY, today);
