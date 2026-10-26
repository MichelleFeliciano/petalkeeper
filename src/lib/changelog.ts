/** What changed in each version, newest first. The newest entry must match package.json (a test checks). */
export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  notes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.7.0',
    date: '2026-10-26',
    notes: [
      'A "New version is ready" banner appears by itself, with an Update now button.',
      '"What\'s new" notes for every version, shown after an update and in the Garden Shed.',
      'Importing a backup now checks first, shows counts, then adds only what is new. Nothing is overwritten and duplicates are skipped.',
      'Backup files carry the app name, app version and the date they were made.',
      'Recently deleted: bring back tasks, routines, templates, counters and countdowns for 30 days.',
      'A History list of recent changes with Undo and Redo, and an Undo toast after every delete.',
      'Search across tasks, routines, steps, journal notes and more (the magnifier, or Ctrl+K).',
      'A Help page and a way to see the welcome again.',
      'Settings check: sync, backup, lock, offline and reminders at a glance.',
      'A warning when this browser\'s storage is nearly full or can\'t save.',
      'Empty screens now have an "Add one now" button.',
    ],
  },
  {
    version: '1.6.1',
    date: '2026-10-26',
    notes: [
      '"On the horizon" no longer repeats to-dos already under "Waiting from earlier".',
      'The daily to-do nudge waits until there is something to say.',
      'Hand-ordering to-dos uses a drag handle (phones keep the arrow buttons).',
      'A note that other pages at the same web address share browser storage.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-26',
    notes: [
      'Undo no longer rolls back unrelated data, and keeps a monthly to-do\'s day of the month when edited.',
      'Month view markup and header fixes, rename Escape cancels, steadier swipes, better contrast.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-10-25',
    notes: ['Phone layout overhaul: no sideways scrolling, bigger tap targets, short menu labels, bottom-sheet dialogs, a jump bar in the Shed.'],
  },
  {
    version: '1.5.0',
    date: '2026-10-25',
    notes: ['Empty-start option, token expiry and replace, data rescue, autosave, accessibility checks, shortcuts, tomorrow preview, undo on the do-now card, summary report, week grid.'],
  },
  {
    version: '1.4.0',
    date: '2026-10-25',
    notes: ['Places and modes (at Mom\'s, vacation, road trip), sync restore and encryption, as-needed items, countdowns, planned rests, journal, share target, weekly backup.'],
  },
  {
    version: '1.3.0',
    date: '2026-10-25',
    notes: ['Do-now card, pause and gentle days, history, starters, counters, mood check-in, PIN, text size, sync status, calendar nudges.'],
  },
  {
    version: '1.2.0',
    date: '2026-10-25',
    notes: ['Routines can belong to specific weekdays.'],
  },
];

/** entries newer than `seen` (the newest one when `seen` isn't a known version), newest first */
export function releasesSince(seen: string | null): Release[] {
  if (!seen) return CHANGELOG.slice(0, 1);
  const i = CHANGELOG.findIndex((r) => r.version === seen);
  return i === -1 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, i);
}
