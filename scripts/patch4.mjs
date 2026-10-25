import { readFileSync, writeFileSync } from 'node:fs';
const F = 'src/pages/Shed.tsx';
let s = readFileSync(F, 'utf8').replace(/\r\n/g, '\n');
const a = s.indexOf('async function updateApp');
const b = s.indexOf('export function Shed');
s = s.slice(0, a) + `const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const label = (v: string, build: string) => \`v\${v} (\${when(build)})\`;

/** Looks for a newer published version; only reloads when there really is one. */
async function updateApp(setNote: (t: string) => void) {
  const mine = label(__APP_VERSION__, __APP_BUILD__);
  setNote('Checking for a new version…');
  let latest: { version: string; build: string };
  try {
    const res = await fetch(\`./version.json?t=\${Date.now()}\`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    latest = await res.json();
  } catch {
    setNote(\`Couldn't check right now. You may be offline. You're on \${mine}.\`);
    return;
  }
  if (latest.build === __APP_BUILD__) {
    setNote(\`You're on the newest version, \${mine}. Nothing to update.\`);
    return;
  }
  setNote(\`Updating from \${mine} to \${label(latest.version, latest.build)}…\`);
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* unsupported: a plain reload still fetches the new files */
  }
  await new Promise((r) => setTimeout(r, 1200));
  location.reload();
}

` + s.slice(b);
s = s.replace(`        <p>Pull the newest version of Petalkeeper. Your activities and settings stay exactly as they are.</p>`,
`        <p>
          You're on <strong>{label(__APP_VERSION__, __APP_BUILD__)}</strong>. Updating pulls the newest version and keeps your activities and settings exactly as they are.
        </p>`);
s = s.replace(`<p role="status" className="hint">{updNote}</p>`, `<p role="status" aria-live="polite" className="ok-msg">{updNote}</p>`);
writeFileSync(F, s.replace(/\n/g, '\r\n'));
