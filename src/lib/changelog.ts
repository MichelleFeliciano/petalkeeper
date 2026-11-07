/** What changed in each version, newest first. The newest entry must match package.json (a test checks). */
export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  notes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.8.0',
    date: '2026-11-07',
    notes: [
      'A weekly look back on the last day of the week and the first day of the next, with one tap to put late to-dos off for a week.',
      'Search opens with "/" too, and remembers your recent searches on this device.',
      'The damaged-data rescue now adds what it finds instead of replacing what you have.',
      'Which place you are at is now remembered separately on each device. Planned stays still sync.',
      'Blooms are earned the first time something is finished, so ticking it off and on again no longer adds more.',
      'Ticking a routine step no longer erases its Start and Finished times.',
      'Calendar (.ics) files wrap long lines so long notes survive every calendar app.',
      'A backup from a newer version of Petalkeeper says so. A routine with an empty name becomes "Untitled routine".',
      'Each sync panel shows only its own error. Reminders explain how to get phone-calendar reminders when the app is closed.',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-11-07',
    notes: [
      'Fixed the Settings check list being squashed on phones, and an indent on the routine four-week history (some new styles shared names with older ones).',
      'A setting cleared on one device, like ending a rest, now clears on your other devices too after a sync.',
      'To-do date words only read real month names, so "buy marble 5" is no longer March 5.',
      'Dates and lists of small numbers in notes are no longer turned into phone links.',
      'Editing just one day of a repeating task no longer trips over a hidden last day.',
      'Disconnecting sync now asks first. The Second Memory file chooser works with a keyboard.',
      'Damaged saved task data is rejected instead of crashing the app. Smaller tidy-ups of repeated code and styles.',
    ],
  },
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
