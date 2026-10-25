import { readFileSync, writeFileSync } from 'node:fs';
import { sub, append } from './lib.mjs';

/* ---- 1. sync: stop re-syncing on every edit (replaceAll changes identity whenever data does) ---- */
const SY = 'src/sync.tsx';
sub(SY, "  const busy = useRef(false);\n", "  const busy = useRef(false);\n  // keep the latest replaceAll in a ref: it changes identity on every edit, and must not retrigger syncing\n  const replaceRef = useRef(replaceAll);\n  replaceRef.current = replaceAll;\n");
sub(SY, "if (stable(merged) !== stable(snapshot)) replaceAll(merged);", "if (stable(merged) !== stable(snapshot)) replaceRef.current(merged);");
sub(SY, "  }, [config, replaceAll]);", "  }, [config]);");

/* ---- 2. store: replacing everything (import, restore, sync apply, reset) must not leave a stale undo behind ---- */
const ST = 'src/store.tsx';
sub(ST, "  const store = useMemo<Store>(() => {\n    const w: Record<string, unknown> = {};", "  const store = useMemo<Store>(() => {\n    const clearUndo = () => {\n      snap.current = null;\n      setToast((t) => (t?.undoable ? null : t));\n    };\n    const w: Record<string, unknown> = {};");
sub(ST, "      replaceAll: (d: AppData) => setData(d),\n      resetSample: () => setData({ ...sampleData(), settings: data.settings }),\n      resetEverything: () =>\n        setData(", "      replaceAll: (d: AppData) => {\n        clearUndo();\n        setData(d);\n      },\n      resetSample: () => {\n        clearUndo();\n        setData({ ...sampleData(), settings: data.settings });\n      },\n      resetEverything: () => {\n        clearUndo();\n        setData(");
sub(ST, "needed: [], neededLog: {}, countdowns: [] }),", "needed: [], neededLog: {}, countdowns: [] });\n      },");

/* ---- 3. service worker: don't cache query URLs, version checks or errors; fresh cache name drops old clutter ---- */
write('public/sw.js', `// Minimal offline cache: network first, fall back to the cached copy.
const CACHE = 'petalkeeper-v3';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './icon.svg', './icon-180.png', './favicon.svg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // only keep plain files: not version checks, shared-text links or other query URLs, and never error pages
  const keep = !url.search && !url.pathname.endsWith('/version.json');
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (keep && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});
`);
function write(f, t) { writeFileSync(f, t); }

/* ---- 4. index.html: safe areas on notched phones, theme colour in dark mode ---- */
sub('index.html', 'content="width=device-width, initial-scale=1.0"', 'content="width=device-width, initial-scale=1.0, viewport-fit=cover"');
sub('index.html', '<meta name="theme-color" content="#FFF7E9" />', '<meta name="theme-color" content="#FFF7E9" media="(prefers-color-scheme: light)" />\n    <meta name="theme-color" content="#232A22" media="(prefers-color-scheme: dark)" />');

/* ---- 5. Modal: land on the first field (or the safe action), not the close button; the dialog itself is focusable ---- */
const M = 'src/components/Modal.tsx';
sub(M, "    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button');\n    first?.focus();", "    const root = ref.current;\n    const first =\n      root?.querySelector<HTMLElement>('input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled)') ??\n      root?.querySelector<HTMLElement>('.actions .btn') ??\n      root?.querySelector<HTMLElement>('button');\n    (first ?? root)?.focus();");
sub(M, "role=\"dialog\" aria-modal=\"true\" aria-label={title} ref={ref}>", "role=\"dialog\" aria-modal=\"true\" aria-label={title} ref={ref} tabIndex={-1}>");

/* ---- 6. places: unknown place guard, end a stay early ---- */
const R = 'src/lib/routines.ts';
sub(R, "export const placeOn = (s: Settings, date: string): string => s.stays.find((st) => st.from <= date && date <= st.until)?.place ?? s.place;", "export const placeOn = (s: Settings, date: string): string =>\n  s.stays.find((st) => st.from <= date && date <= st.until && s.places.some((p) => p.id === st.place))?.place ?? s.place;");
append('src/lib/ops.ts', `
/** end a planned stay early (you came home): it stops the day before \`until\`, or disappears if it hadn't started */
export const endStay = (d: AppData, id: string, lastDay: string): AppData => ({
  ...d,
  settings: {
    ...d.settings,
    stays: d.settings.stays.flatMap((s) => (s.id !== id ? [s] : lastDay < s.from ? [] : [{ ...s, until: lastDay < s.until ? lastDay : s.until }])),
  },
});
`);
const C = 'src/components/Controls.tsx';
sub(C, "import { addDays } from '../lib/dates';", "import { addDays } from '../lib/dates';");
sub(C, "  const { data, today, updateSettings } = useStore();\n  const { settings } = data;\n  const at = placeOn(settings, today);", "  const { data, today, updateSettings, endStay } = useStore();\n  const { settings } = data;\n  const at = placeOn(settings, today);");
sub(C, "      {stay && <span className=\"meta\">A planned stay through {stay.until} has switched this for you.</span>}", "      {stay && (\n        <span className=\"meta\">\n          A planned stay through {stay.until} has switched this for you.{' '}\n          <button className=\"btn small\" onClick={() => endStay(stay.id, addDays(today, -1))}>I'm back, end this stay</button>\n        </span>\n      )}");
const P = 'src/components/PlacesPanel.tsx';
sub(P, "  const name = (id: string) => places.find((p) => p.id === id);", "  const name = (id: string) => places.find((p) => p.id === id);\n  const chosen = places.some((p) => p.id === stayPlace) ? stayPlace : places[0].id;");
sub(P, "<select aria-label=\"Stay place\" value={stayPlace} onChange", "<select aria-label=\"Stay place\" value={chosen} onChange");
sub(P, "s.addStay(stayPlace, from, until)", "s.addStay(chosen, from, until)");

/* ---- 7. calendar nudges: first event on a matching weekday, never ends past midnight ---- */
sub(R, "    const d8 = fromDate.split('-').join('');\n    const t = r.remindAt.replace(':', '') + '00';\n    const [h, m] = r.remindAt.split(':').map(Number);\n    const end = `${String(Math.floor((h * 60 + m + 15) / 60) % 24).padStart(2, '0')}${String((m + 15) % 60).padStart(2, '0')}00`;",
`    const wanted = r.days && r.days.length > 0 && r.days.length < 7 ? r.days : null;
    let first = fromDate;
    for (let i = 0; wanted && i < 7 && !wanted.includes(fromISO(first).getDay()); i++) first = addDays(first, 1);
    const d8 = first.split('-').join('');
    const t = r.remindAt.replace(':', '') + '00';
    const [h, m] = r.remindAt.split(':').map(Number);
    const endMin = Math.min(h * 60 + m + 15, 23 * 60 + 59);
    const end = \`\${String(Math.floor(endMin / 60)).padStart(2, '0')}\${String(endMin % 60).padStart(2, '0')}00\`;`);

/* ---- 8. import/sync: shape-check routine history so a damaged file can't crash the screen ---- */
const V = 'src/lib/storage.ts';
sub(V, "      routineLog: raw.routineLog as AppData['routineLog'],", "      routineLog,");
sub(V, "  if (!isObj(raw.settings)) return { ok: false, error: 'Settings are malformed.' };", `  if (!isObj(raw.settings)) return { ok: false, error: 'Settings are malformed.' };
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
  }`);
sub(V, "  try {\n    localStorage.setItem(STORAGE_KEY + '.corrupt', text);\n  } catch {", "  try {\n    // keep the first damaged copy; don't overwrite it with a later one\n    if (localStorage.getItem(STORAGE_KEY + '.corrupt') === null) localStorage.setItem(STORAGE_KEY + '.corrupt', text);\n  } catch {");

/* ---- 9. Shed copy that contradicted sync ---- */
sub('src/pages/Shed.tsx', "Everything is stored only in this browser on this device. It does not sync to other devices and can be lost if you clear browser data, so export a backup now and then.", "Your data lives in this browser on this device. Sync (above) can keep your other devices in step, but it can still be lost if you clear browser data, so export a backup now and then.");

/* ---- 10. Rituals: drag handle instead of a draggable row, restart timing ---- */
const RI = 'src/pages/Rituals.tsx';
sub(RI, "              draggable={editing}\n              onDragStart={() => setDragIdx(i)}\n              onDragOver", "              onDragOver");
sub(RI, "              <label>\n                <input type=\"checkbox\" className=\"check\" checked={isDone}", "              {editing && (\n                <span className=\"step-handle\" draggable onDragStart={() => setDragIdx(i)} title=\"Drag to reorder\" aria-hidden=\"true\">\n                  ⠿\n                </span>\n              )}\n              <label>\n                <input type=\"checkbox\" className=\"check\" checked={isDone}");
sub(RI, "          {day.start && day.end && <>Took about {Math.max(1, Math.round((new Date(day.end).getTime() - new Date(day.start).getTime()) / 60000))} min today. </>}", "          {day.start && day.end && (\n            <>\n              Took about {Math.max(1, Math.round((new Date(day.end).getTime() - new Date(day.start).getTime()) / 60000))} min today.{' '}\n              <button className=\"btn ghost small\" onClick={() => s.startRoutine(today, routine.id, new Date().toISOString())}>Start again</button>\n            </>\n          )}");

/* ---- 11. mood buttons: toggle buttons (aria-pressed), not a half-built radio group ---- */
for (const f of ['src/components/DailyExtras.tsx', 'src/pages/Journal.tsx']) {
  sub(f, "role=\"radiogroup\"", "role=\"group\"");
  sub(f, "role=\"radio\"\n", "");
  sub(f, "aria-checked={c.mood === m.id}", "aria-pressed={c.mood === m.id}");
}
sub('src/pages/Journal.tsx', "<div className=\"cal\" role=\"grid\" aria-label={title}>", "<div className=\"cal\" role=\"group\" aria-label={title}>");
sub('src/pages/Journal.tsx', "<span key={n} className=\"cal-h\" role=\"columnheader\">{n}</span>", "<span key={n} className=\"cal-h\" aria-hidden=\"true\">{n}</span>");
sub('src/pages/Journal.tsx', "                role=\"gridcell\"\n", "");

/* ---- 12. CSS ---- */
const CSS = 'src/styles.css';
sub(CSS, ".meta { display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; }", "div.meta, p.meta { display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; }");
sub(CSS, "line-height: 1.5; font-size: 17px; }", "line-height: 1.5; font-size: 1.0625rem; }");
sub(CSS, "html[data-text='large'] body { font-size: 19.5px; }\nhtml[data-text='xlarge'] body { font-size: 22px; }", "/* scale the root so rem-based sizes grow too */\nhtml[data-text='large'] { font-size: 115%; }\nhtml[data-text='xlarge'] { font-size: 130%; }");
sub(CSS, ":focus-visible { outline: 3px solid var(--lilac); outline-offset: 2px; border-radius: 6px; }", ":focus-visible { outline: 3px solid var(--moss); outline-offset: 2px; border-radius: 6px; }");
sub(CSS, ".badge { font-size: 0.8rem; padding: 2px 10px; border-radius: 999px; background: var(--lilac, #c9b8d9); color: #3b2f4a; }", ".routine-head .badge { font-size: 0.8rem; padding: 2px 10px; background: var(--lilac, #c9b8d9); color: #3b2f4a; }");
append(CSS, `
/* review fixes */
:root { color-scheme: light; }
:root[data-theme='dark'] { color-scheme: dark; }
.card > h2:first-child { margin-top: 0; }
label.inline select, label.inline input:not([type='checkbox']) { width: auto; }
.step-handle { cursor: grab; user-select: none; padding: 0 4px; color: var(--ink-soft); }
@supports (height: 100dvh) { .lock { min-height: 100dvh; } }
@media (max-width: 760px) {
  .app { padding-bottom: calc(76px + env(safe-area-inset-bottom)); }
  .side { padding-bottom: calc(0.3rem + env(safe-area-inset-bottom)); }
  .toast { bottom: calc(84px + env(safe-area-inset-bottom)); }
}
`);
