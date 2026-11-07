# Petalkeeper change log

Newest first. The same notes appear in the app under "What's new" (see `src/lib/changelog.ts`).

## 1.7.1 — 2026-11-07
- Fixed the Settings check list being squashed on phones, and an indent on the routine four-week history (some new styles shared names with older ones).
- A setting cleared on one device, like ending a rest, now clears on your other devices too after a sync.
- To-do date words only read real month names, so "buy marble 5" is no longer March 5.
- Dates and lists of small numbers in notes are no longer turned into phone links.
- Editing just one day of a repeating task no longer trips over a hidden last day.
- Disconnecting sync now asks first. The Second Memory file chooser works with a keyboard.
- Damaged saved task data is rejected instead of crashing the app. Smaller tidy-ups of repeated code and styles.

## 1.7.0 — 2026-10-26
- A "New version is ready" banner appears by itself, with an Update now button.
- "What's new" notes for every version, shown after an update and in the Garden Shed.
- Importing a backup checks first, shows counts, then adds only what is new. Nothing is overwritten; duplicates are skipped and listed.
- Backup files carry the app name, app version and the date they were made.
- Recently deleted: bring back tasks, routines, templates, counters and countdowns for 30 days.
- A History list of recent changes with Undo and Redo, and an Undo toast after every delete.
- Search across tasks, routines, steps, journal notes and more (magnifier button, or Ctrl+K).
- A Help page, and a way to see the welcome again.
- Settings check: sync, backup, lock, offline and reminders at a glance.
- A warning when browser storage is nearly full or can't save.
- Empty screens have an "Add one now" button.
- The offline cache is named after the app version, so the two always match.

## 1.6.1 — 2026-10-26
- "On the horizon" no longer repeats to-dos already under "Waiting from earlier".
- The daily to-do nudge waits until there is something to say.
- Hand-ordering to-dos uses a drag handle (phones keep the arrow buttons).
- A note that other pages at the same web address share browser storage.

## 1.6.0 — 2026-10-26
- Undo no longer rolls back unrelated data; a monthly to-do keeps its day of the month when edited.
- Month view markup and header fixes, rename Escape cancels, steadier swipes, better contrast.

## 1.5.1 — 2026-10-25
- Phone layout overhaul.

## 1.5.0 — 2026-10-25
- Empty-start option, token expiry and replace, data rescue, autosave, accessibility checks, tomorrow preview, summary report, week grid.

## 1.4.0 — 2026-10-25
- Places and modes, sync restore and encryption, as-needed items, countdowns, planned rests, journal, share target, weekly backup.

## 1.3.0 — 2026-10-25
- Do-now card, pause and gentle days, history, starters, counters, mood check-in, PIN, text size, sync status, calendar nudges.

## 1.2.0 — 2026-10-25
- Routines can belong to specific weekdays.
