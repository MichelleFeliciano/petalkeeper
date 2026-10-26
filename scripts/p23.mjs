import { sub, append } from './lib.mjs';

/* 1. Undo/Redo only touch what they are about (tasks, routines, templates), not mood notes, counters, routine check-offs or settings */
const ST = 'src/store.tsx';
sub(ST, "const Ctx = createContext<Store | null>(null);", "/** Undo and Redo bring back tasks, routines and templates only. Everything else (check-offs, notes, counters, settings) stays as it is now. */\nconst restoreSlice = (from: AppData) => (d: AppData): AppData => ({ ...d, tasks: from.tasks, routines: from.routines, templates: from.templates });\n\nconst Ctx = createContext<Store | null>(null);");
sub(ST, "          future.current.push(current.current);\n          setData(prev);", "          future.current.push(current.current);\n          setData(restoreSlice(prev));");
sub(ST, "          past.current.push(current.current);\n          setData(next);", "          past.current.push(current.current);\n          setData(restoreSlice(next));");

/* 2. editing a monthly to-do must not forget its real day of the month */
sub('src/components/TaskForm.tsx', "recurrence: freq === 'none' ? undefined : { freq, days: freq === 'days' ? days : undefined, until: until || undefined },",
  "recurrence:\n        freq === 'none'\n          ? undefined\n          : {\n              freq,\n              days: freq === 'days' ? days : undefined,\n              until: until || undefined,\n              // keep a day like \"the 31st\" unless the start date was changed\n              ...(freq === 'monthly' && init.recurrence?.dom && date === (init.date ?? '') ? { dom: init.recurrence.dom } : {}),\n            },");

/* 3. Escape while renaming really cancels */
const TC = 'src/components/TaskCard.tsx';
sub(TC, "  const touch = useRef<{ x: number; y: number } | null>(null);\n  const finishRename = () => {\n    setEditing(false);", "  const touch = useRef<{ x: number; y: number } | null>(null);\n  const cancelled = useRef(false);\n  const finishRename = () => {\n    setEditing(false);\n    if (cancelled.current) {\n      cancelled.current = false;\n      return;\n    }");
sub(TC, "if (e.key === 'Escape') setEditing(false);", "if (e.key === 'Escape') {\n                  cancelled.current = true;\n                  setEditing(false);\n                }");
sub(TC, "onClick={() => { setDraft(task.title); setEditing(true); }}", "onClick={() => { cancelled.current = false; setDraft(task.title); setEditing(true); }}");
// a swipe has to be clearly sideways and deliberate before it ticks off or removes something
sub(TC, "if (dy < 40 && Math.abs(dx) >= 80)", "if (dy < 30 && Math.abs(dx) >= 110)");

/* 4. month view: valid markup, honest message; week controls hidden while looking at a month */
const MV = 'src/components/MonthView.tsx';
sub(MV, "<div className=\"month-grid\" role=\"grid\" aria-label={title}>", "<div className=\"month-grid\" role=\"group\" aria-label={title}>");
sub(MV, "<span key={h} className=\"month-dow\" role=\"columnheader\" aria-label={h}>{h.slice(0, 1)}</span>", "<span key={h} className=\"month-dow\" aria-hidden=\"true\">{h.slice(0, 1)}</span>");
sub(MV, "              role=\"gridcell\"\n", "");
sub(MV, "{picked.startsWith(`${cursor.y}-`) ? `Nothing planned for ${fmtLong(picked)}.` : 'Tap a day to see what is planned.'}", "{picked.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`) ? `Nothing planned for ${fmtLong(picked)}.` : 'Tap a day to see what is planned.'}");
const PA = 'src/pages/Path.tsx';
sub(PA, "<h1>{fmtShort(dates[0])} – {fmtShort(dates[6])}</h1>", "<h1>{mode === 'month' ? 'Month' : `${fmtShort(dates[0])} – ${fmtShort(dates[6])}`}</h1>");
sub(PA, "          <button className=\"btn\" onClick={() => setAnchor(addDays(anchor, -7))} aria-label=\"Previous week\">‹ Prev</button>\n          <button className=\"btn\" onClick={() => setAnchor(today)}>This week</button>\n          <button className=\"btn\" onClick={() => setAnchor(addDays(anchor, 7))} aria-label=\"Next week\">Next ›</button>",
  "          {mode !== 'month' && (\n            <>\n              <button className=\"btn\" onClick={() => setAnchor(addDays(anchor, -7))} aria-label=\"Previous week\">‹ Prev</button>\n              <button className=\"btn\" onClick={() => setAnchor(today)}>This week</button>\n              <button className=\"btn\" onClick={() => setAnchor(addDays(anchor, 7))} aria-label=\"Next week\">Next ›</button>\n            </>\n          )}");
sub(PA, "          <button className=\"btn ghost\" onClick={() => setReview(!review)} aria-expanded={review}>Week in review</button>\n          <button className=\"btn ghost\" onClick={() => downloadText(", "          {mode !== 'month' && <button className=\"btn ghost\" onClick={() => setReview(!review)} aria-expanded={review}>Week in review</button>}\n          <button className=\"btn ghost\" onClick={() => downloadText(");

/* 5. colours that stay readable in both themes, and a tappable rename button on phones */
const CSS = 'src/styles.css';
sub(CSS, "color: var(--muted, #6b6b6b); font-size: 0.85rem; }", "color: var(--ink-soft); font-size: 0.85rem; }");
sub(CSS, ".month-day.today { border-color: var(--sage, #7a9a6a); font-weight: 700; }\n.month-day.on { background: var(--sage, #7a9a6a); color: #fff; }", ".month-day.today { border-color: var(--moss); border-width: 2px; font-weight: 700; }\n.month-day.on { background: var(--sage); color: #1f2a1b; }");
append(CSS, "\n@media (max-width: 760px) {\n  .t-btn { min-height: 40px; }\n  .month-day { min-height: 48px; }\n  .quick-add input, .quick-add select { min-height: 46px; }\n}\n");

/* 6. the new import card gets a shortcut chip in the Shed */
sub('src/pages/Shed.tsx', "  ['cc-h', 'Categories'],", "  ['smt-h', 'Import to-dos'],\n  ['cc-h', 'Categories'],");
