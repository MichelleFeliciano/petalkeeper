import { readFileSync, writeFileSync } from 'node:fs';
import { sub, append } from './lib.mjs';

/* ---------- week grid: locale-proof day number ---------- */
sub('src/components/WeekGrid.tsx', "import { fmtShort, weekDates } from '../lib/dates';", "import { fromISO, weekDates } from '../lib/dates';");
sub('src/components/WeekGrid.tsx', "<small>{fmtShort(d).split(' ')[1]}</small>", "<small>{fromISO(d).getDate()}</small>");

/* ---------- DailyExtras ---------- */
const D = 'src/components/DailyExtras.tsx';
sub(D, "import { countdownText, daysUntil, lastDoneLabel } from '../lib/journal';", "import { countdownText, daysUntil, lastDoneLabel } from '../lib/journal';\nimport { useAutosave } from '../lib/useAutosave';\nimport { clearCorruptCopy, corruptCopy, salvage } from '../lib/storage';\nimport { downloadText } from '../lib/ics';\nimport { addDays } from '../lib/dates';\nimport { itemsOn } from '../lib/schedule';\nimport { fmtTime } from '../lib/dates';");
sub(D, "  const { data, today, toggleStep, toggleSkipStep } = useStore();\n  if (isPaused", "  const { data, today, toggleStep, toggleSkipStep, undoable } = useStore();\n  if (isPaused");
sub(D, "onClick={() => toggleStep(today, routine.id, step.id)} aria-label={`Done: ${step.title}`}", "onClick={() => undoable('Checked off.', () => toggleStep(today, routine.id, step.id))} aria-label={`Done: ${step.title}`}");
sub(D, "<button className=\"btn ghost\" onClick={() => toggleSkipStep(today, routine.id, step.id)}>Skip today</button>", "<button className=\"btn ghost\" onClick={() => undoable('Skipped for today.', () => toggleSkipStep(today, routine.id, step.id))}>Skip today</button>");
// autosaving note
sub(D, "  useEffect(() => setNote(c.note ?? ''), [today]); // eslint-disable-line react-hooks/exhaustive-deps", "  useEffect(() => setNote(c.note ?? ''), [today]); // eslint-disable-line react-hooks/exhaustive-deps\n  useAutosave(note, c.note ?? '', (v) => setCheckin(today, { note: v }));");
append(D, `
/** In the evening: what tomorrow holds, so a day-specific routine (like therapy day) isn't a surprise. */
export function TomorrowPreview() {
  const { data, today } = useStore();
  if (new Date().getHours() < 16) return null;
  const tomorrow = addDays(today, 1);
  const routines = routinesFor(data, tomorrow).filter((r) => progressOf(data, r, tomorrow).total > 0);
  const special = routines.filter((r) => r.days && r.days.length > 0);
  const items = itemsOn(data.tasks, tomorrow);
  const first = items.find((o) => o.task.start);
  const there = placeOn(data.settings, tomorrow);
  const move = there !== placeOn(data.settings, today) ? data.settings.places.find((p) => p.id === there) : undefined;
  if (routines.length === 0 && items.length === 0 && !move) return null;
  const day = new Date(tomorrow + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
  return (
    <section className="card" aria-labelledby="tm-h">
      <h2 id="tm-h">Looking ahead to {day}</h2>
      {move && <p>{move.icon} You'll be at {move.label} tomorrow.</p>}
      {special.length > 0 && <p>✨ {special.map((r) => r.name).join(', ')} {special.length === 1 ? 'is' : 'are'} on tomorrow.</p>}
      {routines.length > 0 && <p className="meta">Routines: {routines.map((r) => r.name).join(', ')}</p>}
      {items.length > 0 && (
        <p className="meta">
          {items.length} planned thing{items.length === 1 ? '' : 's'}
          {first?.task.start ? \`, the first at \${fmtTime(first.task.start)}\` : ''}.
        </p>
      )}
    </section>
  );
}

/** Shown only if saved data couldn't be read at some point and a copy was kept. */
export function DamagedDataBanner() {
  const { replaceAll, notify } = useStore();
  const [copy, setCopy] = useState(corruptCopy);
  if (!copy) return null;
  return (
    <div className="notice" role="alert">
      <p>
        <strong>Some saved data couldn't be read</strong> at one point, and a copy of it was kept safe. You can try to bring back what's readable, download the copy, or dismiss this.
      </p>
      <div className="actions left">
        <button
          className="btn primary"
          onClick={() => {
            const rescued = salvage(copy);
            if (!rescued) return notify("Couldn't rescue anything from it.");
            replaceAll(rescued);
            clearCorruptCopy();
            setCopy(null);
            notify(\`Brought back \${rescued.tasks.length} activities and \${rescued.routines.length} routines.\`);
          }}
        >
          Try to bring it back
        </button>
        <button className="btn" onClick={() => downloadText('petalkeeper-damaged-copy.json', copy, 'application/json')}>Download the copy</button>
        <button
          className="btn ghost"
          onClick={() => {
            clearCorruptCopy();
            setCopy(null);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
`);
sub('src/pages/Today.tsx', "import { AsNeeded, Countdowns, DoNow, TodaysRoutines, Counters, CheckIn } from '../components/DailyExtras';", "import { AsNeeded, Countdowns, DamagedDataBanner, DoNow, TodaysRoutines, TomorrowPreview, Counters, CheckIn } from '../components/DailyExtras';");
sub('src/pages/Today.tsx', "      <PlaceSwitcher />\n", "      <DamagedDataBanner />\n\n      <PlaceSwitcher />\n");
sub('src/pages/Today.tsx', "      <AsNeeded />\n", "      <TomorrowPreview />\n\n      <AsNeeded />\n");

/* ---------- Journal: autosaving notes + shareable summary ---------- */
const J = 'src/pages/Journal.tsx';
sub(J, "import { useEffect, useMemo, useState } from 'react';", "import { useMemo, useState } from 'react';\nimport { SummaryReport } from '../components/Report';\nimport { useAutosave } from '../lib/useAutosave';");
sub(J, "/** A calendar of how days felt", `/** The note box for one day. Keyed by date, so switching days starts it fresh; saves as you pause typing. */
function NoteEditor({ date }: { date: string }) {
  const { data, setCheckin } = useStore();
  const saved = data.checkins[date]?.note ?? '';
  const [note, setNote] = useState(saved);
  useAutosave(note, saved, (v) => setCheckin(date, { note: v }));
  return (
    <label>
      Note for this day
      <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== saved && setCheckin(date, { note })} />
    </label>
  );
}

/** A calendar of how days felt`);
sub(J, "  const [note, setNote] = useState(c.note ?? '');\n  useEffect(() => setNote(data.checkins[sel]?.note ?? ''), [sel]); // eslint-disable-line react-hooks/exhaustive-deps\n", "");
sub(J, "        <label>\n          Note for this day\n          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (c.note ?? '') && setCheckin(sel, { note })} />\n        </label>\n", "        <NoteEditor key={sel} date={sel} />\n");
sub(J, "      <section className=\"card\" aria-labelledby=\"js-h\">", "      <SummaryReport />\n\n      <section className=\"card\" aria-labelledby=\"js-h\">");
// things that shouldn't appear when the summary is printed
for (const [from, to] of [
  ["<header>\n        <p className=\"eyebrow\">Garden Journal", "<header className=\"no-print\">\n        <p className=\"eyebrow\">Garden Journal"],
  ["<section className=\"card\" aria-label=\"A gentle observation\">", "<section className=\"card no-print\" aria-label=\"A gentle observation\">"],
  ["<section className=\"card\" aria-label=\"Month\">", "<section className=\"card no-print\" aria-label=\"Month\">"],
  ["<section className=\"card\" aria-labelledby=\"jd-h\">", "<section className=\"card no-print\" aria-labelledby=\"jd-h\">"],
  ["<section className=\"card\" aria-labelledby=\"js-h\">", "<section className=\"card no-print\" aria-labelledby=\"js-h\">"],
]) sub(J, from, to);

/* ---------- Rituals: week grid, pasted lists, undo in guided mode ---------- */
const R = 'src/pages/Rituals.tsx';
sub(R, "import { PlaceSwitcher, RestControls } from '../components/Controls';", "import { PlaceSwitcher, RestControls } from '../components/Controls';\nimport { WeekGrid } from '../components/WeekGrid';\nimport { stepLines } from '../lib/journal';");
sub(R, "      <PlaceSwitcher />\n      <RestControls />", "      <WeekGrid />\n      <PlaceSwitcher />\n      <RestControls />");
sub(R, "<input aria-label=\"New step name\" placeholder=\"New step\" value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />", `<input
              aria-label="New step name"
              placeholder="New step (or paste a list)"
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              onPaste={(e) => {
                const lines = stepLines(e.clipboardData.getData('text'));
                if (lines.length < 2) return;
                e.preventDefault();
                s.setSteps(routine.id, [...routine.steps, ...lines.map((title) => ({ id: newId(), title }))]);
              }}
            />`);
sub(R, "<button className=\"btn ghost\" onClick={() => s.toggleSkipStep(today, routine.id, cur.id)}>Skip today</button>", "<button className=\"btn ghost\" onClick={() => s.undoable('Skipped for today.', () => s.toggleSkipStep(today, routine.id, cur.id))}>Skip today</button>");
sub(R, "<button className=\"btn primary\" onClick={() => s.toggleStep(today, routine.id, cur.id)}>Done ✓</button>", "<button className=\"btn primary\" onClick={() => s.undoable('Checked off.', () => s.toggleStep(today, routine.id, cur.id))}>Done ✓</button>");

/* ---------- App: offline note, token warning ---------- */
const A = 'src/App.tsx';
sub(A, "import { SyncProvider, useSync } from './sync';", "import { SyncProvider, useSync } from './sync';\nimport { daysLeft } from './lib/sync';");
sub(A, "function SyncChip({ onOpen }: { onOpen: () => void }) {\n  const sync = useSync();", "function SyncChip({ onOpen }: { onOpen: () => void }) {\n  const sync = useSync();\n  const { today } = useStore();");
sub(A, "  if (!sync.config) return null;\n  const mins", "  if (!sync.config) return null;\n  const left = daysLeft(sync.config.tokenExpires, today);\n  const expiring = left !== null && left <= 14;\n  const mins");
sub(A, "    sync.status === 'syncing' ? 'Syncing…' : sync.status === 'error' ? 'Sync problem. Tap to see' :", "    sync.status === 'syncing' ? 'Syncing…' : sync.status === 'error' ? 'Sync problem. Tap to see' : expiring ? (left! <= 0 ? 'Token expired. Tap to renew' : `Token expires in ${left} day${left === 1 ? '' : 's'}`) :");
sub(A, "className={'sync-chip' + (sync.status === 'error' ? ' bad' : '')}", "className={'sync-chip' + (sync.status === 'error' || expiring ? ' bad' : '')}");
sub(A, "<span aria-hidden=\"true\">{sync.status === 'error' ? '⚠️' : '☁️'}</span>", "<span aria-hidden=\"true\">{sync.status === 'error' || expiring ? '⚠️' : '☁️'}</span>");
sub(A, "/** If you've turned it on,", `/** A quiet note when there's no connection. Nothing breaks; it just explains why syncing waits. */
function OfflineNote() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <p className="offline" role="status">
      📴 You're offline. Everything still works here, and syncing will pick up again when you're back.
    </p>
  );
}

/** If you've turned it on,`);
sub(A, "      <main id=\"main\" tabIndex={-1}>\n", "      <main id=\"main\" tabIndex={-1}>\n        <OfflineNote />\n");

/* ---------- Tour: start empty ---------- */
const G = 'src/components/Gate.tsx';
sub(G, "import { checkPin, hasPin, markTourSeen, tourSeen } from '../lib/device';", "import { checkPin, hasPin, markTourSeen, tourSeen } from '../lib/device';\nimport { isFreshSample } from '../lib/storage';\nimport { useStore } from '../store';\nimport { loadSyncConfig } from '../lib/sync';");
sub(G, "export function Tour() {\n  const [open, setOpen] = useState(() => !tourSeen());", "export function Tour() {\n  const { resetEverything } = useStore();\n  const [open, setOpen] = useState(() => !tourSeen());\n  // only offer this when the app is showing its built-in examples (not data that arrived from another device)\n  const examples = isFreshSample() && !loadSyncConfig();");
sub(G, "      <div className=\"actions\"><button className=\"btn primary\" onClick={close}>Got it</button></div>", `      {examples && <p className="hint">The tasks and routines you see are just examples to look around with.</p>}
      <div className="actions">
        {examples && (
          <button
            className="btn"
            onClick={() => {
              resetEverything();
              close();
            }}
          >
            Start with an empty garden
          </button>
        )}
        <button className="btn primary" onClick={close}>{examples ? 'Keep the examples for now' : 'Got it'}</button>
      </div>`);

/* ---------- Sync panel: token expiry + replace token ---------- */
const P = 'src/components/SyncPanel.tsx';
sub(P, "import type { Version } from '../lib/sync';", "import { daysLeft, type Version } from '../lib/sync';\nimport { useStore } from '../store';");
sub(P, "export function SyncPanel() {", `/** When the access token runs out, and a way to swap in a new one without disconnecting. */
function TokenInfo({ run, busy, err }: { run: (fn: () => Promise<unknown>) => Promise<void>; busy: boolean; err: string }) {
  const sync = useSync();
  const { today } = useStore();
  const [token, setToken] = useState('');
  const [exp, setExp] = useState('');
  const left = daysLeft(sync.config?.tokenExpires, today);
  return (
    <details className="sync-more" open={left !== null && left <= 14}>
      <summary>Access token{left !== null ? (left <= 0 ? ' (expired)' : \` (expires in \${left} day\${left === 1 ? '' : 's'})\`) : ''}</summary>
      {left !== null && left <= 14 && (
        <p className="error" role="alert">
          {left <= 0 ? 'Your token has expired, so syncing has stopped.' : \`Your token expires in \${left} day\${left === 1 ? '' : 's'}.\`} Make a new one on GitHub (Settings → Developer settings → Fine-grained tokens), then paste it below.
        </p>
      )}
      <label>
        Token expires on (optional, so I can warn you)
        <input type="date" value={sync.config?.tokenExpires ?? ''} onChange={(e) => sync.setTokenExpires(e.target.value || undefined)} />
      </label>
      <label>
        New token
        <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <label>
        New token expires on (optional)
        <input type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
      </label>
      <button
        className="btn"
        disabled={busy || !token.trim()}
        onClick={() =>
          void run(async () => {
            await sync.replaceToken(token, exp || undefined);
            setToken('');
            setExp('');
            await sync.syncNow();
          })
        }
      >
        Replace token
      </button>
      {err && <p className="error" role="alert">{err}</p>}
    </details>
  );
}

export function SyncPanel() {`);
sub(P, "          <PrivacyAndHistory run={run} busy={busy} err={err} />", "          <TokenInfo run={run} busy={busy} err={err} />\n          <PrivacyAndHistory run={run} busy={busy} err={err} />");
sub(P, "  const [passphrase, setPassphrase] = useState('');", "  const [passphrase, setPassphrase] = useState('');\n  const [expires, setExpires] = useState('');");
sub(P, "const r = await sync.connect(repo, token, passphrase);\n                if (r === 'connected') {\n                  setToken('');\n                  setPassphrase('');\n                }", "const r = await sync.connect(repo, token, passphrase, expires || undefined);\n                if (r === 'connected') {\n                  setToken('');\n                  setPassphrase('');\n                }");
sub(P, "            <label>\n              Passphrase (only if your cloud copy is encrypted)", "            <label>\n              Token expires on (optional, so I can warn you before it stops working)\n              <input type=\"date\" value={expires} onChange={(e) => setExpires(e.target.value)} />\n            </label>\n            <label>\n              Passphrase (only if your cloud copy is encrypted)");

/* ---------- Shed: number fields you can clear while typing ---------- */
const S = 'src/pages/Shed.tsx';
sub(S, "export function Shed() {", `/** A number box that lets you clear it and type a new value; it only commits a valid number. */
function NumField({ value, min, step, onCommit }: { value: number; min: number; step: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n) && n >= min) onCommit(n);
      }}
      onBlur={() => {
        const n = Number(text);
        if (text === '' || !Number.isFinite(n) || n < min) setText(String(value));
      }}
    />
  );
}

export function Shed() {`);
sub(S, "import { useRef, useState } from 'react';", "import { useEffect, useRef, useState } from 'react';");
sub(S, "<input type=\"number\" min=\"5\" step=\"5\" value={settings.defaultDuration} onChange={(e) => s.updateSettings({ defaultDuration: Math.max(5, Number(e.target.value) || 30) })} />", "<NumField value={settings.defaultDuration} min={5} step={5} onCommit={(n) => s.updateSettings({ defaultDuration: n })} />");
sub(S, "<input type=\"number\" min=\"0\" step=\"5\" value={settings.buffer} onChange={(e) => s.updateSettings({ buffer: Math.max(0, Number(e.target.value) || 0) })} />", "<NumField value={settings.buffer} min={0} step={5} onCommit={(n) => s.updateSettings({ buffer: n })} />");
sub(S, "<input type=\"number\" min=\"0\" step=\"5\" value={settings.notifyLead} onChange={(e) => s.updateSettings({ notifyLead: Math.max(0, Number(e.target.value) || 0) })} />", "<NumField value={settings.notifyLead} min={0} step={5} onCommit={(n) => s.updateSettings({ notifyLead: n })} />");

/* ---------- manifest shortcuts, CSS ---------- */
sub('public/manifest.webmanifest', '  "share_target"', '  "shortcuts": [\n    { "name": "Today", "short_name": "Today", "url": "./#/today" },\n    { "name": "Daily Rituals", "short_name": "Rituals", "url": "./#/rituals" },\n    { "name": "Garden Journal", "short_name": "Journal", "url": "./#/journal" }\n  ],\n  "share_target"');
append('src/styles.css', `
/* v1.5 */
.offline { margin: 0 0 8px; padding: 8px 12px; border-radius: 12px; background: var(--warn-bg); color: var(--warn); font-size: 0.9rem; }
.chips-row { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 6px 0; }
.report-body h3 { margin: 0.8rem 0 0.2rem; font-size: 1.1rem; }
.report-body h4 { margin: 0.8rem 0 0.2rem; font-size: 1rem; }
.wg-scroll { overflow-x: auto; }
.wg { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
.wg th, .wg td { padding: 4px 6px; text-align: center; border-bottom: 1px dotted var(--line); }
.wg th[scope='row'] { text-align: left; font-weight: normal; }
.wg th small { display: block; opacity: 0.8; }
.wg .today { background: color-mix(in srgb, var(--petal) 25%, transparent); }
.wg-all { color: #c4708a; }
.wg-off { opacity: 0.4; }
.week-glance summary { cursor: pointer; }
@media print {
  .no-print { display: none !important; }
  .report { border: 0; box-shadow: none; }
}
`);
