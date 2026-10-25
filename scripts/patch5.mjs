import { readFileSync, writeFileSync } from 'node:fs';
const sub = (file, from, to) => {
  const raw = readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const s = raw.replace(/\r\n/g, '\n');
  if (!s.includes(from)) throw new Error(`missing in ${file}: ${from.slice(0, 60)}`);
  const out = s.replace(from, to);
  writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
};

sub('src/lib/types.ts', "  steps: RoutineStep[];\n}", "  steps: RoutineStep[];\n  /** weekdays it belongs to (0 = Sunday … 6 = Saturday). Empty or missing means every day. */\n  days?: number[];\n}");

sub('src/lib/schedule.ts', "import type { Task } from './types';", "import type { Routine, Task } from './types';");
const sched = readFileSync('src/lib/schedule.ts', 'utf8');
writeFileSync('src/lib/schedule.ts', sched.replace(/\s*$/, '\n') + `
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** does this routine belong on that date? (no days chosen = every day) */
export const routineOn = (r: Routine, iso: string): boolean => !r.days || r.days.length === 0 || r.days.includes(fromISO(iso).getDay());
/** "Every day", "Tuesdays", "Mon, Wed & Fri" */
export function routineDaysLabel(days?: number[]): string {
  if (!days || days.length === 0 || days.length === 7) return 'Every day';
  const d = [...days].sort((a, b) => a - b);
  return d.length === 1 ? LONG_DAYS[d[0]] + 's' : d.map((x) => LONG_DAYS[x].slice(0, 3)).join(', ').replace(/, ([^,]*)$/, ' & $1');
}
`);

sub('src/lib/storage.ts', "!Array.isArray(r.steps) ||", "(r.days !== undefined && !(Array.isArray(r.days) && r.days.every((x) => Number.isInteger(x) && x >= 0 && x <= 6))) ||\n      !Array.isArray(r.steps) ||");

sub('src/lib/ops.ts', "export const renameRoutine", `export const setRoutineDays = (d: AppData, id: string, days: number[]): AppData => ({
  ...d,
  routines: d.routines.map((r) => {
    if (r.id !== id) return r;
    const { days: _old, ...rest } = r;
    void _old;
    return days.length === 0 || days.length === 7 ? rest : { ...rest, days: [...days].sort((a, b) => a - b) };
  }),
});

export const renameRoutine`);

// Rituals: chips + label + "not today"
const R = 'src/pages/Rituals.tsx';
sub(R, "import { newId } from '../lib/schedule';", "import { newId, routineDaysLabel, routineOn } from '../lib/schedule';");
sub(R, "          <label className=\"inline\">\n            Part of the day", `          <fieldset className="day-chips">
            <legend>Which days? (none picked = every day)</legend>
            {(data.settings.weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]).map((n) => {
              const on = routine.days?.includes(n) ?? false;
              const name = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n];
              return (
                <label key={n} className={'chip' + (on ? ' on' : '')}>
                  <input
                    type="checkbox"
                    aria-label={name}
                    checked={on}
                    onChange={() => s.setRoutineDays(routine.id, on ? (routine.days ?? []).filter((x) => x !== n) : [...(routine.days ?? []), n])}
                  />
                  {name.slice(0, 3)}
                </label>
              );
            })}
          </fieldset>
          <label className="inline">
            Part of the day`);
sub(R, "        <span className=\"meta\">\n          {done}/{active.length} done", "        {routine.days && routine.days.length > 0 && <span className=\"badge\">{routineDaysLabel(routine.days)}</span>}\n        {!routineOn(routine, today) && <span className=\"meta\">Not on today's list</span>}\n        <span className=\"meta\">\n          {done}/{active.length} done");
sub(R, "  const { data, today } = s;\n  const day = routineDay(data, today, routine.id);\n  const [editing", "  const { data, today } = s;\n  const day = routineDay(data, today, routine.id);\n  const [editing");

// Today: only routines for today
sub('src/pages/Today.tsx', "r.kind === p.id && r.steps.length > 0)", "r.kind === p.id && r.steps.length > 0 && routineOn(r, today))");
sub('src/pages/Today.tsx', "import { findConflicts, isDone, itemsOn }", "import { findConflicts, isDone, itemsOn, routineOn }");
