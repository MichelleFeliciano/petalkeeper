import { sub } from './lib.mjs';

/* ---------- logic ---------- */

// "market 5" or "decor 3" at the end of a to-do were being read as March 5 / December 3: month words must be real month names
sub('src/lib/dateWords.ts', "`(?:${MONTH_WORDS.join('|')})[a-z]*\\\\.?\\\\s+\\\\d{1,2}(?:st|nd|rd|th)?`,", "'(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\\\.?\\\\s+\\\\d{1,2}(?:st|nd|rd|th)?',");

// a damaged per-day list of finished steps would crash the app when read
sub('src/lib/storage.ts', "  if (!isObj(t.subDone)) return false;\n", "  if (!isObj(t.subDone) || !Object.values(t.subDone).every((v) => Array.isArray(v) && v.every(isStr))) return false;\n");

// a setting cleared on one device (ending a rest, switching off the daily nudge) is now cleared on the others too
sub('src/lib/sync.ts', "  const keys = [...settingsMap(local).keys()];\n  const sm = mergeMaps(settingsMap(base), settingsMap(local), settingsMap(remote));\n  const settings = { ...local.settings } as unknown as Record<string, unknown>;\n  for (const k of keys) if (!LOCAL_ONLY.has(k) && sm.has(k)) settings[k] = sm.get(k);\n  // optional settings that were cleared on one side\n",
  "  const sm = mergeMaps(settingsMap(base), settingsMap(local), settingsMap(remote));\n  const settings = { ...local.settings } as unknown as Record<string, unknown>;\n  // every setting either side has; one that was cleared on a device (like ending a rest) is cleared everywhere\n  for (const k of new Set([...settingsMap(local).keys(), ...settingsMap(remote).keys()])) {\n    if (LOCAL_ONLY.has(k)) continue;\n    if (sm.has(k)) settings[k] = sm.get(k);\n    else delete settings[k];\n  }\n");
sub('src/lib/sync.ts', "/** Replace the cloud copy with this device's data. */\n/** just the current file's id", "/** just the current file's id");
sub('src/lib/sync.ts', "export async function pushReplace(", "/** Replace the cloud copy with this device's data. */\nexport async function pushReplace(");

// notes like "2026-11-07" or "12 15 20 25" were turned into phone links
sub('src/lib/journal.ts', "    else out.push({ text: m[2], href: 'tel:' + m[2].replace(/[^\\d+]/g, '') });", "    else if (looksLikePhone(m[2])) out.push({ text: m[2], href: 'tel:' + m[2].replace(/[^\\d+]/g, '') });\n    else out.push({ text: m[2] });");
sub('src/lib/journal.ts', "export type Piece = { text: string; href?: string };", "type Piece = { text: string; href?: string };\n/** 7 to 15 digits with a run of at least three, and not a date */\nconst looksLikePhone = (s: string) => {\n  const digits = s.replace(/\\D/g, '').length;\n  return digits >= 7 && digits <= 15 && /\\d{3}/.test(s) && !/^\\d{4}-\\d{2}-\\d{2}$/.test(s);\n};");

// editing just one day of a repeating task no longer trips over its hidden "last day"
sub('src/components/TaskForm.tsx', "if (until && date && until < date)", "if (!occurrenceDate && until && date && until < date)");

// "Next up" showed NaN for a task with an end time but no start time
sub('src/pages/Today.tsx', "    items.find((o) => !isDone(o.task, o.date));\n", "    items.find((o) => !isDone(o.task, o.date));\n  const nextLength = next ? (next.task.duration ?? (next.task.start && next.task.end ? toMinutes(next.task.end) - toMinutes(next.task.start) : 0)) : 0;\n");
sub('src/pages/Today.tsx', "            {next.task.duration || next.task.end ? ` · ${fmtDuration(next.task.duration ?? toMinutes(next.task.end!) - toMinutes(next.task.start!))}` : ''}", "            {nextLength > 0 ? ` · ${fmtDuration(nextLength)}` : ''}");
sub('src/pages/Today.tsx', "  const { data, today, copyDay, moveOccurrence } = useStore();\n  const { openForm } = useUI();", "  const { data, today, copyDay, moveOccurrence, updateSettings } = useStore();\n  const { openForm } = useUI();");
sub('src/pages/Today.tsx', "  const { updateSettings } = useStore();\n", "");

/* ---------- accessibility ---------- */

// the file chooser was a hidden input that the keyboard could not reach
sub('src/components/SecondMemoryTodos.tsx', "import { useState } from 'react';", "import { useRef, useState } from 'react';");
sub('src/components/SecondMemoryTodos.tsx', "  const [error, setError] = useState('');\n", "  const [error, setError] = useState('');\n  const fileRef = useRef<HTMLInputElement>(null);\n");
sub('src/components/SecondMemoryTodos.tsx', "        <label className=\"btn\">\n          Choose the export file\n          <input type=\"file\" accept=\"application/json,.json\" style={{ display: 'none' }} onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = ''; }} />\n        </label>",
  "        <button className=\"btn\" onClick={() => fileRef.current?.click()}>Choose the export file</button>\n        <input ref={fileRef} type=\"file\" accept=\"application/json,.json\" hidden aria-label=\"Second Memory export file\" onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = ''; }} />");

// a routine with the same name and the same count no longer shares a list key
sub('src/components/Report.tsx', "{rep.routines.map((r) => (\n                  <li key={r.name + r.scheduled}>", "{rep.routines.map((r, i) => (\n                  <li key={i}>");

// disconnecting forgets the token, so ask first
const SP = 'src/components/SyncPanel.tsx';
sub(SP, "  const [err, setErr] = useState('');\n\n  const run", "  const [err, setErr] = useState('');\n  const [confirmOff, setConfirmOff] = useState(false);\n\n  const run");
sub(SP, "<button className=\"btn\" onClick={sync.disconnect}>", "<button className=\"btn\" onClick={() => setConfirmOff(true)}>");
sub(SP, "      {sync.pending && (\n        <Modal", "      {confirmOff && (\n        <Modal title=\"Disconnect this device?\" onClose={() => setConfirmOff(false)}>\n          <p>Everything stays on this device. The access token is forgotten, so you would paste it in again to reconnect.</p>\n          <div className=\"actions\">\n            <button className=\"btn\" data-autofocus onClick={() => setConfirmOff(false)}>Stay connected</button>\n            <button\n              className=\"btn danger\"\n              onClick={() => {\n                setConfirmOff(false);\n                sync.disconnect();\n              }}\n            >\n              Disconnect\n            </button>\n          </div>\n        </Modal>\n      )}\n\n      {sync.pending && (\n        <Modal");

/* ---------- unnecessary code ---------- */

const AD = 'src/components/AdjustDay.tsx';
sub(AD, "import { findConflicts, isDone, itemsOn, type Occurrence } from '../lib/schedule';", "import { findConflicts, itemsOn, type Occurrence } from '../lib/schedule';");
sub(AD, "\nexport function leftover(tasksItems: Occurrence[]) {\n  return tasksItems.filter((o) => !isDone(o.task, o.date));\n}\n", "");

sub('src/components/DailyExtras.tsx', "import { addDays } from '../lib/dates';\nimport { itemsOn } from '../lib/schedule';\nimport { fmtTime } from '../lib/dates';", "import { addDays, fmtTime } from '../lib/dates';\nimport { itemsOn } from '../lib/schedule';");
sub('src/components/DailyExtras.tsx', "            key={m.id}\n                        aria-pressed", "            key={m.id}\n            aria-pressed");
sub('src/pages/Journal.tsx', "              key={m.id}\n                            aria-pressed", "              key={m.id}\n              aria-pressed");

// one list of weekday names (dates.ts) instead of four copies
sub('src/lib/schedule.ts', "import { fromISO, toISO, toMinutes, weekday, addDays } from './dates';", "import { DAY_NAMES, fromISO, toISO, toMinutes, weekday, addDays } from './dates';");
sub('src/lib/schedule.ts', "const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];\n", "");
sub('src/lib/schedule.ts', "LONG_DAYS[d[0]] + 's' : d.map((x) => LONG_DAYS[x]", "DAY_NAMES[d[0]] + 's' : d.map((x) => DAY_NAMES[x]");
sub('src/pages/Rituals.tsx', "const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];\n\n", "");
sub('src/pages/Rituals.tsx', "DAY_LONG[n] + suffix", "DAY_NAMES[n] + suffix");
sub('src/pages/Rituals.tsx', "{DAY_LONG[n].slice(0, 3)}", "{DAY_NAMES[n].slice(0, 3)}");
sub('src/pages/Rituals.tsx', "import { addDays, fmtDuration } from '../lib/dates';", "import { addDays, DAY_NAMES, fmtDuration } from '../lib/dates';");
sub('src/pages/Rituals.tsx', "import { linkify, typicalMinutes } from '../lib/journal';", "import { linkify, stepLines, typicalMinutes } from '../lib/journal';");
sub('src/pages/Rituals.tsx', "import { stepLines } from '../lib/journal';\nimport type { Place } from '../lib/types';\nimport { PARTS, currentPart, partOf, type PartOfDay, type Routine } from '../lib/types';", "import { PARTS, currentPart, partOf, type PartOfDay, type Place, type Routine } from '../lib/types';");
sub('src/components/MonthView.tsx', "const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];\n\n", "");
sub('src/components/MonthView.tsx', "NAMES[(weekStart + i) % 7]", "DAY_NAMES[(weekStart + i) % 7]");
sub('src/components/MonthView.tsx', "import { fmtLong } from '../lib/dates';", "import { DAY_NAMES, fmtLong } from '../lib/dates';");
sub('src/components/WeekGrid.tsx', "const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];\n\n", "");
sub('src/components/WeekGrid.tsx', "{SHORT[new Date(d + 'T12:00:00').getDay()]}", "{DAY_NAMES[weekday(d)].slice(0, 3)}");
sub('src/components/WeekGrid.tsx', "import { fromISO, weekDates } from '../lib/dates';", "import { DAY_NAMES, fromISO, weekDates, weekday } from '../lib/dates';");
sub('src/pages/Path.tsx', "import { categoryOf } from '../lib/types';\n", "");
sub('src/pages/Path.tsx', "import { allCategories, MOODS } from '../lib/types';", "import { allCategories, categoryOf, MOODS } from '../lib/types';");

/* ---------- CSS ---------- */

// my v1.7 class names collided with older ones: .check (the tick boxes), .history (the routine's four-week details), .block (the hour view)
sub('src/components/DataSafety.tsx', '<ul className="check">', '<ul className="status-list">');
sub('src/components/DataSafety.tsx', '<ol className="history"', '<ol className="change-list"');
sub('src/components/DataSafety.tsx', '<small className="block">', '<small className="skipped-names">');
const CSS = 'src/styles.css';
sub(CSS, ".check { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }\n.check li { display: grid; grid-template-columns: 1.6rem minmax(0, 1fr) auto; gap: 0.5rem; align-items: center; }\n.check .mark { font-weight: 700; text-align: center; }\n.check li.ok .mark { color: var(--ink); }\n.check li.warn .mark { color: var(--warn); }\n.check small { color: var(--ink-soft); }\n.history { margin: 0.5rem 0; padding-left: 1.3rem; }\n.history small { color: var(--ink-soft); }",
  ".status-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }\n.status-list li { display: grid; grid-template-columns: 1.6rem minmax(0, 1fr) auto; gap: 0.5rem; align-items: center; }\n.status-list .mark { font-weight: 700; text-align: center; }\n.status-list li.ok .mark { color: var(--ink); }\n.status-list li.warn .mark { color: var(--warn); }\n.status-list small { color: var(--ink-soft); }\n.change-list { margin: 0.5rem 0; padding-left: 1.3rem; }\n.change-list small { color: var(--ink-soft); }");
sub(CSS, ".block { display: block; }", ".skipped-names { display: block; }");
// duplicates
sub(CSS, ".fairy { flex: none; } .fairy { max-width: 28vw; height: auto; }", ".fairy { flex: none; max-width: 28vw; height: auto; }");
sub(CSS, ".task { border-left-color: var(--cat, var(--sage)); }\n.task[data-priority='high'] { border-left-color: var(--petal); }\n.task[data-priority='low'] { border-left-color: var(--lilac); }\n", ".task { border-left-color: var(--cat, var(--sage)); }\n");
sub(CSS, "  .app { grid-template-columns: 1fr; padding-bottom: 72px; }", "  .app { grid-template-columns: 1fr; }");
sub(CSS, "@media (max-width: 760px) {\n  .app { padding-bottom: calc(76px + env(safe-area-inset-bottom)); }\n  .side { padding-bottom: calc(0.3rem + env(safe-area-inset-bottom)); }\n  .toast { bottom: calc(84px + env(safe-area-inset-bottom)); }\n}\n", "");
