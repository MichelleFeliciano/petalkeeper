import type { AppData } from './types';

/** Importing a backup adds what is new and never overwrites. This is the check-first preview and the merge itself. */
export type Group = 'tasks' | 'routines' | 'templates' | 'counters' | 'needed' | 'countdowns' | 'journal' | 'checkoffs';

export const GROUP_LABEL: Record<Group, [string, string]> = {
  tasks: ['activity', 'activities'],
  routines: ['routine', 'routines'],
  templates: ['template', 'templates'],
  counters: ['counter', 'counters'],
  needed: ['as-needed item', 'as-needed items'],
  countdowns: ['countdown', 'countdowns'],
  journal: ['journal day', 'journal days'],
  checkoffs: ['day of routine check-offs', 'days of routine check-offs'],
};

export interface MergeReport {
  added: Record<Group, number>;
  skipped: Record<Group, number>;
  /** names of the things that were skipped as already here (first few) */
  skippedNames: string[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const zero = (): Record<Group, number> => ({ tasks: 0, routines: 0, templates: 0, counters: 0, needed: 0, countdowns: 0, journal: 0, checkoffs: 0 });

export function mergeImport(cur: AppData, inc: AppData): { data: AppData; report: MergeReport } {
  const report: MergeReport = { added: zero(), skipped: zero(), skippedNames: [] };
  const skip = (g: Group, name: string) => {
    report.skipped[g]++;
    if (name && report.skippedNames.length < 12) report.skippedNames.push(name);
  };

  // tasks: the same id, or the same title on the same day at the same time, counts as already here
  const taskKey = (t: AppData['tasks'][number]) => [norm(t.title), t.date ?? '', t.start ?? '', t.recurrence?.freq ?? '', t.recurrence?.days?.join('') ?? ''].join('|');
  const taskIds = new Set(cur.tasks.map((t) => t.id));
  const taskKeys = new Set(cur.tasks.map(taskKey));
  const tasks = [...cur.tasks];
  for (const t of inc.tasks) {
    if (taskIds.has(t.id) || taskKeys.has(taskKey(t))) skip('tasks', t.title);
    else {
      tasks.push(t);
      taskIds.add(t.id);
      taskKeys.add(taskKey(t));
      report.added.tasks++;
    }
  }

  // routines, counters, as-needed items, templates, countdowns: same id or same name
  const routineMap = new Map<string, string>();
  const routines = [...cur.routines];
  for (const r of inc.routines) {
    const same = routines.find((x) => x.id === r.id || (x.kind === r.kind && norm(x.name) === norm(r.name)));
    if (same) {
      routineMap.set(r.id, same.id);
      skip('routines', r.name);
    } else {
      routines.push(r);
      routineMap.set(r.id, r.id);
      report.added.routines++;
    }
  }

  const byName = <T extends { id: string }>(list: T[], incoming: T[], name: (x: T) => string, g: Group) => {
    const out = [...list];
    const map = new Map<string, string>();
    for (const x of incoming) {
      const same = out.find((y) => y.id === x.id || norm(name(y)) === norm(name(x)));
      if (same) {
        map.set(x.id, same.id);
        skip(g, name(x));
      } else {
        out.push(x);
        map.set(x.id, x.id);
        report.added[g]++;
      }
    }
    return { out, map };
  };
  const tpl = byName(cur.templates, inc.templates, (x) => x.name, 'templates');
  const cnt = byName(cur.counters, inc.counters, (x) => x.label, 'counters');
  const ned = byName(cur.needed, inc.needed, (x) => x.label, 'needed');
  const cdn = byName(cur.countdowns, inc.countdowns, (x) => `${x.label} ${x.date}`, 'countdowns');

  // check-offs and counts: only for days/items that aren't recorded here yet
  const routineLog = { ...cur.routineLog };
  for (const [date, row] of Object.entries(inc.routineLog)) {
    let addedAny = false;
    const merged = { ...(routineLog[date] ?? {}) };
    for (const [rid, day] of Object.entries(row)) {
      const id = routineMap.get(rid);
      if (id && !merged[id]) {
        merged[id] = day;
        addedAny = true;
      }
    }
    if (addedAny) {
      routineLog[date] = merged;
      report.added.checkoffs++;
    }
  }
  const counterLog = { ...cur.counterLog };
  for (const [date, row] of Object.entries(inc.counterLog)) {
    const merged = { ...(counterLog[date] ?? {}) };
    for (const [cid, n] of Object.entries(row)) {
      const id = cnt.map.get(cid);
      if (id && merged[id] === undefined) merged[id] = n;
    }
    counterLog[date] = merged;
  }
  const neededLog = { ...cur.neededLog };
  for (const [nid, times] of Object.entries(inc.neededLog)) {
    const id = ned.map.get(nid);
    if (id) neededLog[id] = [...new Set([...(neededLog[id] ?? []), ...times])].sort().slice(-50);
  }
  const checkins = { ...cur.checkins };
  for (const [date, c] of Object.entries(inc.checkins)) {
    if (checkins[date]) skip('journal', date);
    else {
      checkins[date] = c;
      report.added.journal++;
    }
  }

  // settings stay as they are here; only categories and places that are missing are added so nothing points at nothing
  const settings = {
    ...cur.settings,
    customCategories: [...cur.settings.customCategories, ...inc.settings.customCategories.filter((c) => !cur.settings.customCategories.some((x) => x.id === c.id))],
    places: [...cur.settings.places, ...inc.settings.places.filter((p) => !cur.settings.places.some((x) => x.id === p.id))],
  };

  return {
    report,
    data: { ...cur, tasks, routines, templates: tpl.out, counters: cnt.out, needed: ned.out, countdowns: cdn.out, routineLog, counterLog, neededLog, checkins, settings, blooms: Math.max(cur.blooms, inc.blooms) },
  };
}

export const totalAdded = (r: MergeReport) => Object.values(r.added).reduce((a, b) => a + b, 0);
export const totalSkipped = (r: MergeReport) => Object.values(r.skipped).reduce((a, b) => a + b, 0);

/** "3 activities, 1 routine" for the groups that have something in them */
export function describeCounts(counts: Record<Group, number>): string {
  const parts = (Object.keys(GROUP_LABEL) as Group[]).filter((g) => counts[g] > 0).map((g) => `${counts[g]} ${GROUP_LABEL[g][counts[g] === 1 ? 0 : 1]}`);
  return parts.join(', ');
}
