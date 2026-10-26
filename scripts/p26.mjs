import { sub } from './lib.mjs';

/* 1. "On the horizon": don't repeat late to-dos that "Waiting from earlier" already shows (keep ones late only by their due date) */
const T = 'src/pages/Today.tsx';
sub(T, "  const comingUp = attention.soon.filter((t) => (t.date ?? t.due) !== today);", "  const comingUp = attention.soon.filter((t) => (t.date ?? t.due) !== today);\n  // late to-dos that \"Waiting from earlier\" already lists are not repeated here\n  const lateElsewhere = attention.late.filter((t) => !(t.date && t.date < today));");
sub(T, "{(comingUp.length > 0 || attention.late.length > 0) && (", "{(comingUp.length > 0 || lateElsewhere.length > 0) && (");
sub(T, "<small>{attention.late.length > 0 ? `${attention.late.length} late · ` : ''}{comingUp.length} in the next 7 days</small>", "<small>{lateElsewhere.length > 0 ? `${lateElsewhere.length} late · ` : ''}{comingUp.length} in the next 7 days</small>");
sub(T, "{[...attention.late, ...comingUp].slice(0, 8).map((t) => (", "{[...lateElsewhere, ...comingUp].slice(0, 8).map((t) => (");
sub(T, "{attention.late.includes(t) ? ' · late' : ''}", "{lateElsewhere.includes(t) ? ' · late' : ''}");

/* 2. the daily to-do nudge counts as "sent" only when it actually was, so a to-do added later that day still gets its nudge */
const A = 'src/App.tsx';
sub(A, "      if (last === today) return;\n      try { localStorage.setItem(TODO_NUDGE_KEY, today); } catch { /* ignore */ }\n      const n = reminderCount(data.tasks, today);\n      if (n > 0) new Notification('Petalkeeper', { body: reminderText(n), icon: './icon.svg' });",
  "      if (last === today) return;\n      const n = reminderCount(data.tasks, today);\n      if (n === 0) return; // nothing to say yet; look again at the next check\n      try { localStorage.setItem(TODO_NUDGE_KEY, today); } catch { /* ignore */ }\n      new Notification('Petalkeeper', { body: reminderText(n), icon: './icon.svg' });");

/* 3. hand-ordering: drag by a handle, so the rename box inside a row is still easy to use in Firefox */
const S = 'src/pages/Seeds.tsx';
sub(S, "            draggable={manual}\n            onDragStart={() => { dragId.current = t.id; }}\n            onDragOver", "            onDragOver");
sub(S, "            <TaskCard\n              occ={{ task: t, date: d, key: t.id }}", "            {manual && (\n              <span className=\"drag-handle\" draggable onDragStart={() => { dragId.current = t.id; }} title=\"Drag to move\" aria-hidden=\"true\">\n                ⠿ drag\n              </span>\n            )}\n            <TaskCard\n              occ={{ task: t, date: d, key: t.id }}");
sub('src/styles.css', ".todo-row[draggable='true'] { cursor: grab; }", ".drag-handle { display: inline-block; cursor: grab; user-select: none; font-size: 0.8rem; color: var(--ink-soft); padding: 2px 6px; }\n@media (max-width: 760px) { .drag-handle { display: none; } } /* phones use the arrow buttons */");

/* 4. say plainly that pages on the same address can read what is saved in the browser */
sub('src/components/SyncPanel.tsx', "Anyone using this browser profile could use it, so only connect on devices you trust.", "Anyone using this browser profile could use it, so only connect on devices you trust. Other pages hosted at {window.location.host} share this browser storage too, so only keep pages you trust there.");
