import { sub } from './lib.mjs';

// ---- types
const TY = 'src/lib/types.ts';
sub(TY, "  /** weekdays this step applies to (0 = Sunday); missing means every day the routine runs */\n  days?: number[];\n}", "  /** weekdays this step applies to (0 = Sunday); missing means every day the routine runs */\n  days?: number[];\n  /** a private note or link, like an address or a phone number */\n  note?: string;\n}");
sub(TY, "export interface RoutineDay {\n  done: string[];\n  skipped: string[];\n}", "export interface RoutineDay {\n  done: string[];\n  skipped: string[];\n  /** optional timing: ISO timestamps from the Start and Finished buttons */\n  start?: string;\n  end?: string;\n}");
sub(TY, "  gentleOn?: string;", "  gentleOn?: string;\n  /** rests planned ahead, like a trip */\n  plannedPauses: PlannedPause[];");
sub(TY, "export interface Counter {", `export interface PlannedPause {
  id: string;
  from: string;
  until: string;
}
/** something done now and then, with the time you last did it */
export interface Needed {
  id: string;
  label: string;
  icon: string;
}
export interface Countdown {
  id: string;
  label: string;
  icon: string;
  date: string;
}

export interface Counter {`);
sub(TY, "  checkins: Record<string, Checkin>;\n}", "  checkins: Record<string, Checkin>;\n  needed: Needed[];\n  /** needed-item id -> ISO timestamps, oldest first */\n  neededLog: Record<string, string[]>;\n  countdowns: Countdown[];\n}");
sub(TY, "  customCategories: [],\n};", "  customCategories: [],\n  plannedPauses: [],\n};");

// ---- empty constructors
sub('src/lib/seed.ts', "    checkins: {},", "    checkins: {},\n    needed: [],\n    neededLog: {},\n    countdowns: [],");
sub('src/test/helpers.ts', "  checkins: {},", "  checkins: {},\n  needed: [],\n  neededLog: {},\n  countdowns: [],");
sub('src/store.tsx', "counterLog: {}, checkins: {} }", "counterLog: {}, checkins: {}, needed: [], neededLog: {}, countdowns: [] }");

// ---- validation
const ST = 'src/lib/storage.ts';
sub(ST, "(s.days === undefined || (Array.isArray(s.days) && s.days.every((x) => Number.isInteger(x) && x >= 0 && x <= 6))))", "(s.days === undefined || (Array.isArray(s.days) && s.days.every((x) => Number.isInteger(x) && x >= 0 && x <= 6))) && (s.note === undefined || isStr(s.note)))");
sub(ST, "  let counters: Counter[] = [];", `  if (Array.isArray(s.plannedPauses)) {
    settings.plannedPauses = (s.plannedPauses as unknown[]).filter(
      (p): p is PlannedPause => isObj(p) && isStr(p.id) && isISODate(p.from) && isISODate(p.until),
    );
  }
  let needed: Needed[] = [];
  if (raw.needed !== undefined) {
    if (!Array.isArray(raw.needed) || !raw.needed.every((n) => isObj(n) && isStr(n.id) && isStr(n.label) && isStr(n.icon))) {
      return { ok: false, error: 'As-needed items in the file are malformed.' };
    }
    needed = raw.needed as Needed[];
  }
  const neededLog: AppData['neededLog'] = {};
  if (isObj(raw.neededLog)) {
    for (const [id, v] of Object.entries(raw.neededLog)) if (Array.isArray(v)) neededLog[id] = v.filter(isStr).slice(-50);
  }
  let countdowns: Countdown[] = [];
  if (raw.countdowns !== undefined) {
    if (!Array.isArray(raw.countdowns) || !raw.countdowns.every((c) => isObj(c) && isStr(c.id) && isStr(c.label) && isStr(c.icon) && isISODate(c.date))) {
      return { ok: false, error: 'Countdowns in the file are malformed.' };
    }
    countdowns = raw.countdowns as Countdown[];
  }
  let counters: Counter[] = [];`);
sub(ST, "      counters,\n      counterLog,", "      needed,\n      neededLog,\n      countdowns,\n      counters,\n      counterLog,");
sub(ST, "type Counter, type Mood,", "type Counter, type Countdown, type Mood, type Needed, type PlannedPause,");

// ---- sync merge
const SY = 'src/lib/sync.ts';
sub(SY, "    return { done, skipped: [...new Set([...l.skipped, ...r.skipped])].filter((s) => !done.includes(s)) };", "    return {\n      done,\n      skipped: [...new Set([...l.skipped, ...r.skipped])].filter((s) => !done.includes(s)),\n      ...(l.start ?? r.start ? { start: l.start ?? r.start } : {}),\n      ...(l.end ?? r.end ? { end: l.end ?? r.end } : {}),\n    };");
sub(SY, "  const keys = [...settingsMap(local).keys()];", `  const needed = mergeMaps(base ? byId(base.needed) : new Map(), byId(local.needed), byId(remote.needed));
  const countdowns = mergeMaps(base ? byId(base.countdowns) : new Map(), byId(local.countdowns), byId(remote.countdowns));
  const neededLog = Object.fromEntries(
    mergeMaps(new Map(Object.entries(base?.neededLog ?? {})), new Map(Object.entries(local.neededLog)), new Map(Object.entries(remote.neededLog)), (l, r) =>
      [...new Set([...l, ...r])].sort().slice(-50),
    ),
  );
  const keys = [...settingsMap(local).keys()];`);
sub(SY, "    counters: [...counters.values()],", "    needed: [...needed.values()],\n    neededLog,\n    countdowns: [...countdowns.values()],\n    counters: [...counters.values()],");
