import type { AppData } from './types';

/** Search across everything saved in the app. All the words typed must appear (any order, any case). */
export type HitPage = 'today' | 'rituals' | 'seeds' | 'path' | 'journal';
export interface Hit {
  key: string;
  kind: string;
  title: string;
  detail?: string;
  page: HitPage;
}

const MAX_PER_KIND = 8;

export function searchAll(d: AppData, query: string): Hit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const has = (...texts: (string | undefined)[]) => {
    const hay = texts.filter(Boolean).join(' \n ').toLowerCase();
    return words.every((w) => hay.includes(w));
  };
  const out: Hit[] = [];
  const add = (hits: Hit[]) => out.push(...hits.slice(0, MAX_PER_KIND));

  add(
    d.tasks
      .filter((t) => has(t.title, t.notes, ...t.subtasks.map((s) => s.title)))
      .map((t) => ({ key: 'task-' + t.id, kind: 'Task', title: t.title, detail: t.date ? t.date : t.done ? 'done' : 'no date yet', page: 'seeds' as const })),
  );
  add(d.routines.filter((r) => has(r.name)).map((r) => ({ key: 'routine-' + r.id, kind: 'Routine', title: r.name, detail: `${r.steps.length} step${r.steps.length === 1 ? '' : 's'}`, page: 'rituals' as const })));
  add(
    d.routines.flatMap((r) =>
      r.steps.filter((s) => has(s.title, s.note)).map((s) => ({ key: 'step-' + s.id, kind: 'Routine step', title: s.title, detail: `in ${r.name}`, page: 'rituals' as const })),
    ),
  );
  add(
    Object.entries(d.checkins)
      .filter(([, c]) => has(c.note))
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, c]) => ({ key: 'note-' + date, kind: 'Journal', title: date, detail: (c.note ?? '').slice(0, 100), page: 'journal' as const })),
  );
  add(d.countdowns.filter((c) => has(c.label)).map((c) => ({ key: 'cd-' + c.id, kind: 'Countdown', title: `${c.icon} ${c.label}`, detail: c.date, page: 'today' as const })));
  add(d.counters.filter((c) => has(c.label)).map((c) => ({ key: 'ct-' + c.id, kind: 'Counter', title: `${c.icon} ${c.label}`, page: 'today' as const })));
  add(d.needed.filter((n) => has(n.label)).map((n) => ({ key: 'nd-' + n.id, kind: 'As needed', title: `${n.icon} ${n.label}`, page: 'today' as const })));
  add(d.templates.filter((t) => has(t.name, ...t.items.map((i) => i.title))).map((t) => ({ key: 'tp-' + t.id, kind: 'Template', title: t.name, detail: 'open Templates on Today', page: 'today' as const })));
  return out;
}
