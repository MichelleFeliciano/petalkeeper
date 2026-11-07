import { sub } from './lib.mjs';

/* ===== 3. blooms are earned once; ticking a step no longer erases the routine's Start/Finished times ===== */
const OPS = 'src/lib/ops.ts';
sub(OPS, `  const was = isDone(t, date);
  const next = mapTask(d, id, (x) =>
    x.recurrence
      ? { ...x, completions: was ? x.completions.filter((c) => c !== date) : [...x.completions, date] }
      : { ...x, done: !was },
  );
  return was ? next : { ...next, blooms: next.blooms + 1 };`, `  const was = isDone(t, date);
  // a bloom is earned the first time something is finished, so ticking it off and on again doesn't grow the garden
  const key = t.recurrence ? date : 'once';
  const first = !was && !(t.bloomed ?? []).includes(key);
  const earned = first ? { bloomed: [...(t.bloomed ?? []), key] } : {};
  const next = mapTask(d, id, (x) =>
    x.recurrence
      ? { ...x, ...earned, completions: was ? x.completions.filter((c) => c !== date) : [...x.completions, date] }
      : { ...x, ...earned, done: !was },
  );
  return first ? { ...next, blooms: next.blooms + 1 } : next;`);
sub(OPS, `  const next = setRoutineDay(d, date, rid, {
    done: was ? day.done.filter((s) => s !== stepId) : [...day.done, stepId],
    skipped: day.skipped.filter((s) => s !== stepId),
  });
  return was ? next : { ...next, blooms: next.blooms + 1 };`, `  const first = !was && !(day.bloomed ?? []).includes(stepId);
  const next = setRoutineDay(d, date, rid, {
    ...day, // keeps the Start and Finished times
    done: was ? day.done.filter((s) => s !== stepId) : [...day.done, stepId],
    skipped: day.skipped.filter((s) => s !== stepId),
    ...(first ? { bloomed: [...(day.bloomed ?? []), stepId] } : {}),
  });
  return first ? { ...next, blooms: next.blooms + 1 } : next;`);
sub(OPS, `  return setRoutineDay(d, date, rid, {
    done: day.done.filter((s) => s !== stepId),`, `  return setRoutineDay(d, date, rid, {
    ...day,
    done: day.done.filter((s) => s !== stepId),`);
sub(OPS, "    subDone: {},\n    subtasks: ", "    subDone: {},\n    bloomed: undefined,\n    subtasks: ", true);
sub(OPS, "      date: to,\n      done: false,\n", "      date: to,\n      done: false,\n      bloomed: undefined,\n");
sub('src/lib/types.ts', "  /** place in a hand-arranged list", "  /** which days (or \"once\") already earned a bloom, so ticking something off and on again doesn't earn more */\n  bloomed?: string[];\n  /** place in a hand-arranged list");
sub('src/lib/types.ts', "  start?: string;\n  end?: string;\n}\nexport type RoutineLog", "  start?: string;\n  end?: string;\n  /** step ids that already earned a bloom today */\n  bloomed?: string[];\n}\nexport type RoutineLog");
sub('src/lib/storage.ts', "  if (t.order !== undefined && (typeof t.order", "  if (t.bloomed !== undefined && !(Array.isArray(t.bloomed) && t.bloomed.every(isStr))) return false;\n  if (t.order !== undefined && (typeof t.order");
sub('src/lib/storage.ts', "        ...(isStr(day.end) ? { end: day.end } : {}),\n", "        ...(isStr(day.end) ? { end: day.end } : {}),\n        ...(Array.isArray(day.bloomed) ? { bloomed: day.bloomed.filter(isStr) } : {}),\n");
sub('src/lib/sync.ts', "      ...(l.end ?? r.end ? { end: l.end ?? r.end } : {}),\n", "      ...(l.end ?? r.end ? { end: l.end ?? r.end } : {}),\n      ...(l.bloomed || r.bloomed ? { bloomed: [...new Set([...(l.bloomed ?? []), ...(r.bloomed ?? [])])] } : {}),\n");

/* ===== 1. the damaged-data rescue adds what it finds and never replaces what you have ===== */
const DE = 'src/components/DailyExtras.tsx';
sub(DE, "import { downloadText } from '../lib/ics';", "import { downloadText } from '../lib/ics';\nimport { describeCounts, mergeImport, totalAdded } from '../lib/merge';");
sub(DE, "  const { replaceAll, notify } = useStore();\n  const [copy, setCopy] = useState(corruptCopy);", "  const { data, replaceAll, notify } = useStore();\n  const [copy, setCopy] = useState(corruptCopy);");
sub(DE, "            replaceAll(rescued);\n            clearCorruptCopy();\n            setCopy(null);\n            notify(`Brought back ${rescued.tasks.length} activities and ${rescued.routines.length} routines.`);",
  "            // add what was readable to what is here now; nothing you have is replaced\n            const { data: merged, report } = mergeImport(data, rescued);\n            if (totalAdded(report) > 0) replaceAll(merged);\n            clearCorruptCopy();\n            setCopy(null);\n            notify(totalAdded(report) > 0 ? `Brought back ${describeCounts(report.added)}.` : 'Everything readable was already here.');");

/* ===== 2. calendar files wrap long lines the way the standard asks ===== */
const ICS = 'src/lib/ics.ts';
sub(ICS, "const d8 = ", "/** Lines over 75 bytes continue on the next line, which starts with a space (RFC 5545), so long notes survive every calendar app. */\nexport function foldLine(line: string): string {\n  const enc = new TextEncoder();\n  let out = '';\n  let cur = '';\n  let bytes = 0;\n  let limit = 75;\n  for (const ch of line) {\n    const n = enc.encode(ch).length;\n    if (bytes + n > limit) {\n      out += cur + '\\r\\n ';\n      cur = '';\n      bytes = 0;\n      limit = 74;\n    }\n    cur += ch;\n    bytes += n;\n  }\n  return out + cur;\n}\nconst d8 = ");
sub(ICS, "  lines.push('END:VCALENDAR');\n  return lines.join('\\r\\n') + '\\r\\n';", "  lines.push('END:VCALENDAR');\n  return lines.map(foldLine).join('\\r\\n') + '\\r\\n';");
sub('src/lib/routines.ts', "  lines.push('END:VCALENDAR');\n  return { text: lines.join('\\r\\n') + '\\r\\n', count };", "  lines.push('END:VCALENDAR');\n  return { text: lines.map(foldLine).join('\\r\\n') + '\\r\\n', count };");
sub('src/lib/routines.ts', "import { routineOn } from './schedule';", "import { routineOn } from './schedule';\nimport { foldLine } from './ics';");

/* ===== 4. each sync panel keeps its own busy state and error ===== */
const SP = 'src/components/SyncPanel.tsx';
sub(SP, "function PrivacyAndHistory({ run, busy, err }: { run: (fn: () => Promise<unknown>) => Promise<void>; busy: boolean; err: string }) {\n  const sync = useSync();", "function PrivacyAndHistory() {\n  const sync = useSync();\n  const { run, busy, err } = useRun();");
sub(SP, "function TokenInfo({ run, busy, err }: { run: (fn: () => Promise<unknown>) => Promise<void>; busy: boolean; err: string }) {\n  const sync = useSync();", "function TokenInfo() {\n  const sync = useSync();\n  const { run, busy, err } = useRun();");
sub(SP, "const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');\n", "const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');\n\n/** runs one action, with its own busy flag and error message so panels don't show each other's problems */\nfunction useRun() {\n  const [busy, setBusy] = useState(false);\n  const [err, setErr] = useState('');\n  const run = async (fn: () => Promise<unknown>) => {\n    setBusy(true);\n    setErr('');\n    try {\n      await fn();\n    } catch (e) {\n      setErr(errText(e));\n    } finally {\n      setBusy(false);\n    }\n  };\n  return { busy, err, run };\n}\n");
sub(SP, "  const [busy, setBusy] = useState(false);\n  const [err, setErr] = useState('');\n  const [confirmOff, setConfirmOff] = useState(false);\n\n  const run = async (fn: () => Promise<unknown>) => {\n    setBusy(true);\n    setErr('');\n    try {\n      await fn();\n    } catch (e) {\n      setErr(errText(e));\n    } finally {\n      setBusy(false);\n    }\n  };\n", "  const { busy, err, run } = useRun();\n  const [confirmOff, setConfirmOff] = useState(false);\n");
sub(SP, "<TokenInfo run={run} busy={busy} err={err} />\n          <PrivacyAndHistory run={run} busy={busy} err={err} />", "<TokenInfo />\n          <PrivacyAndHistory />");

/* ===== 5. where you are is remembered separately on each device ===== */
const SY = 'src/lib/sync.ts';
sub(SY, "export const forCloud = (d: AppData): AppData => ({ ...d, settings: { ...d.settings, notifications: false } });", "export const forCloud = (d: AppData): AppData => ({ ...d, settings: { ...d.settings, notifications: false, place: d.settings.places[0]?.id ?? d.settings.place } });");
sub(SY, "const LOCAL_ONLY = new Set(['notifications']);", "const LOCAL_ONLY = new Set(['notifications', 'place']);");
sub(SY, "/** the copy stored in the cloud never carries per-device settings */", "/** the copy stored in the cloud never carries per-device settings (reminders on/off, which place you are at) */");
const SC = 'src/sync.tsx';
sub(SC, "const message = ", "/** data that arrives from the cloud keeps this device's own reminder switch and place */\nconst keepDevice = (from: AppData, local: AppData): AppData => ({\n  ...from,\n  settings: {\n    ...from.settings,\n    notifications: local.settings.notifications,\n    place: from.settings.places.some((p) => p.id === local.settings.place) ? local.settings.place : from.settings.place,\n  },\n});\n\nconst message = ");
sub(SC, "        const next = { ...remote, settings: { ...remote.settings, notifications: local.settings.notifications } };", "        const next = keepDevice(remote, local);");
sub(SC, "      const next = { ...old, settings: { ...old.settings, notifications: dataRef.current.settings.notifications } };", "      const next = keepDevice(old, dataRef.current);");
sub('src/components/PlacesPanel.tsx', "      <ul className=\"plain\">\n        {places.map", "      <p className=\"hint\">Which place you're at is remembered separately on each device, so your phone can be at Mom's while your computer stays home. Planned stays below are shared by all your devices.</p>\n      <ul className=\"plain\">\n        {places.map");

/* ===== 6. a backup from a newer version says so ===== */
sub('src/lib/storage.ts', "  if (raw.version !== 1) return { ok: false, error: 'Unsupported backup version.' };", "  if (typeof raw.version === 'number' && raw.version > 1) return { ok: false, error: 'That file was made by a newer version of Petalkeeper. Update the app (Garden Shed → Update app), then try again.' };\n  if (raw.version !== 1) return { ok: false, error: 'Unsupported backup version.' };");

/* ===== 7. a routine always has a name ===== */
const RI = 'src/pages/Rituals.tsx';
sub(RI, "<input aria-label=\"Routine name\" value={routine.name} onChange={(e) => s.renameRoutine(routine.id, e.target.value)} />", "<input aria-label=\"Routine name\" value={routine.name} onChange={(e) => s.renameRoutine(routine.id, e.target.value)} onBlur={() => !routine.name.trim() && s.renameRoutine(routine.id, 'Untitled routine')} />");

/* ===== 8. reminders when the app is closed: point to the calendar export ===== */
sub('src/pages/Shed.tsx', "Everything works fine with reminders off.</p>", "Everything works fine with reminders off.</p>\n        <p className=\"hint\">\n          Want reminders even when the app is closed? Export your routine nudges below and open the file on your phone: your phone's own calendar sends them.{' '}\n          <button className=\"btn small\" onClick={() => document.getElementById('bk-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Go to the calendar export</button>\n        </p>");
sub('src/components/Finder.tsx', "['Working offline',", "['Reminders', 'Gentle reminders only appear while the app is open. For reminders when it is closed, set a nudge time on a routine (Daily Rituals → Edit), then use Export routine nudges (.ics) in the Garden Shed and open the file on your phone. Its own calendar will remind you.'],\n  ['Working offline',");
sub('src/components/Finder.tsx', "The magnifier (or Ctrl+K) searches everything.", "The magnifier (or Ctrl+K, or just \"/\") searches everything.");

/* ===== 9. a weekly look back ===== */
sub(DE, "import { addDays, fmtTime } from '../lib/dates';", "import { addDays, fmtTime, weekDates, weekday } from '../lib/dates';\nimport { weekSummary } from '../lib/summary';\nimport { needsAttention, snoozeTo } from '../lib/todo';");
sub(DE, "/** Shown only if saved data couldn't be read", `const REVIEW_KEY = 'petalkeeper.weekReviewed';

/** On the last day of the week and the first day of the next: a kind look back, and one tap to put late to-dos off for a week. */
export function WeeklyReview() {
  const { data, today, snoozeTask } = useStore();
  const { weekStart } = data.settings;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(REVIEW_KEY) === today;
    } catch {
      return false;
    }
  });
  const dow = weekday(today);
  const looksBack = dow === weekStart;
  if (hidden || (dow !== (weekStart + 6) % 7 && !looksBack)) return null;
  const w = weekSummary(data, weekDates(looksBack ? addDays(today, -7) : today, weekStart));
  if (w.total === 0 && w.routineSteps === 0) return null;
  const late = needsAttention(data.tasks, today, 7).late;
  const done = () => {
    try {
      localStorage.setItem(REVIEW_KEY, today);
    } catch {
      /* it just shows again next time */
    }
    setHidden(true);
  };
  return (
    <section className="card" aria-labelledby="wr-h">
      <h2 id="wr-h">A look at {looksBack ? 'last week' : 'this week'}</h2>
      <p>
        {w.done} of {w.total} activities tended{w.routineSteps > 0 ? ', and ' + w.routineSteps + ' routine steps' : ''}. {w.message}
      </p>
      {late.length > 0 && <p className="meta">{late.length} to-do{late.length === 1 ? ' is' : 's are'} still waiting from before today.</p>}
      <div className="actions left">
        {late.length > 0 && (
          <button
            className="btn"
            onClick={() => {
              for (const t of late) snoozeTask(t.id, t.date ?? t.due ?? today, snoozeTo(today, 'week'));
              done();
            }}
          >
            Put {late.length === 1 ? 'it' : 'all ' + late.length} off for a week
          </button>
        )}
        <button className="btn ghost" onClick={done}>Done for now</button>
      </div>
    </section>
  );
}

/** Shown only if saved data couldn't be read`);
sub('src/pages/Today.tsx', "import { AsNeeded, Countdowns, DamagedDataBanner, DoNow, TodaysRoutines, TomorrowPreview, Counters, CheckIn } from '../components/DailyExtras';", "import { AsNeeded, Countdowns, DamagedDataBanner, DoNow, TodaysRoutines, TomorrowPreview, Counters, CheckIn, WeeklyReview } from '../components/DailyExtras';");
sub('src/pages/Today.tsx', "      <TomorrowPreview />\n", "      <TomorrowPreview />\n\n      <WeeklyReview />\n");

/* ===== 10. "/" opens search, and it remembers your recent searches (on this device) ===== */
sub('src/App.tsx', "      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {\n        e.preventDefault();\n        setFinder('search');\n      }", "      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {\n        e.preventDefault();\n        setFinder('search');\n      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {\n        // only when you aren't typing in a box or looking at a dialog\n        if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('[role=\"dialog\"]')) return;\n        e.preventDefault();\n        setFinder('search');\n      }");
sub('src/App.tsx', "title=\"Search (Ctrl+K)\"", "title=\"Search (Ctrl+K or /)\"");
const SE = 'src/lib/search.ts';
sub(SE, "const MAX_PER_KIND = 8;", "const MAX_PER_KIND = 8;\n\n/** the last few things searched for, kept on this device only */\nconst RECENT_KEY = 'petalkeeper.recentSearches';\nexport function loadRecentSearches(): string[] {\n  try {\n    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');\n    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];\n  } catch {\n    return [];\n  }\n}\nexport function rememberSearch(q: string): string[] {\n  const t = q.trim();\n  if (t.length < 2) return loadRecentSearches();\n  const next = [t, ...loadRecentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6);\n  try {\n    localStorage.setItem(RECENT_KEY, JSON.stringify(next));\n  } catch {\n    /* just not remembered */\n  }\n  return next;\n}\nexport function clearRecentSearches() {\n  try {\n    localStorage.removeItem(RECENT_KEY);\n  } catch {\n    /* ignore */\n  }\n}");
const FI = 'src/components/Finder.tsx';
sub(FI, "import { searchAll, type HitPage } from '../lib/search';", "import { clearRecentSearches, loadRecentSearches, rememberSearch, searchAll, type HitPage } from '../lib/search';");
sub(FI, "  const [q, setQ] = useState('');\n  const hits", "  const [q, setQ] = useState('');\n  const [recent, setRecent] = useState(loadRecentSearches);\n  const hits");
sub(FI, "        {!q.trim() && <p className=\"hint\">Type a word or two. Everything stays on this device.</p>}", "        {!q.trim() && <p className=\"hint\">Type a word or two. Everything stays on this device.</p>}\n        {!q.trim() && recent.length > 0 && (\n          <div className=\"chips-row\" role=\"group\" aria-label=\"Recent searches\">\n            {recent.map((r) => (\n              <button key={r} className=\"tab\" onClick={() => setQ(r)}>{r}</button>\n            ))}\n            <button\n              className=\"btn ghost small\"\n              onClick={() => {\n                clearRecentSearches();\n                setRecent([]);\n              }}\n            >\n              Clear recent\n            </button>\n          </div>\n        )}");
sub(FI, "                onClick={() => {\n                  onGo(h.page);", "                onClick={() => {\n                  rememberSearch(q);\n                  onGo(h.page);");

/* ===== version and notes ===== */
sub('package.json', '"version": "1.7.1"', '"version": "1.8.0"');
const NOTES = [
  'A weekly look back on the last day of the week and the first day of the next, with one tap to put late to-dos off for a week.',
  'Search opens with "/" too, and remembers your recent searches on this device.',
  'The damaged-data rescue now adds what it finds instead of replacing what you have.',
  'Which place you are at is now remembered separately on each device. Planned stays still sync.',
  'Blooms are earned the first time something is finished, so ticking it off and on again no longer adds more.',
  'Ticking a routine step no longer erases its Start and Finished times.',
  'Calendar (.ics) files wrap long lines so long notes survive every calendar app.',
  'A backup from a newer version of Petalkeeper says so. A routine with an empty name becomes "Untitled routine".',
  'Each sync panel shows only its own error. Reminders explain how to get phone-calendar reminders when the app is closed.',
];
sub('src/lib/changelog.ts', "export const CHANGELOG: Release[] = [\n", "export const CHANGELOG: Release[] = [\n  {\n    version: '1.8.0',\n    date: '2026-11-07',\n    notes: [\n" + NOTES.map((n) => `      '${n.replace(/'/g, "\\'")}',`).join('\n') + "\n    ],\n  },\n");
sub('CHANGELOG.md', "## 1.7.1 — 2026-11-07", "## 1.8.0 — 2026-11-07\n" + NOTES.map((n) => `- ${n}`).join('\n') + "\n\n## 1.7.1 — 2026-11-07");
