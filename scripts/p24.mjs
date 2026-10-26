import { sub } from './lib.mjs';
const S = 'src/store.tsx';
sub(S, "const restoreSlice = (from: AppData) => (d: AppData): AppData => ({ ...d, tasks: from.tasks, routines: from.routines, templates: from.templates });",
`type Part = 'tasks' | 'routines' | 'templates' | 'routineLog';
interface Entry {
  /** how things were before the change */
  d: AppData;
  /** the parts of the data this step brings back */
  parts: Part[];
}
const TASK_PARTS: Part[] = ['tasks', 'routines', 'templates'];
/** ticking a routine step off (or skipping it) from the "do this now" card can be undone too, and only that is brought back */
const ROUTINE_LOG_OPS = new Set(['toggleStep', 'toggleSkipStep']);
const restore = (e: Entry) => (d: AppData): AppData => {
  const next = { ...d } as Record<string, unknown>;
  for (const p of e.parts) next[p] = e.d[p];
  return next as unknown as AppData;
};`);
sub(S, "  const past = useRef<AppData[]>([]);\n  const future = useRef<AppData[]>([]);", "  const past = useRef<Entry[]>([]);\n  const future = useRef<Entry[]>([]);");
sub(S, "(fn: (d: AppData) => AppData, label?: string, tracked = false) => {", "(fn: (d: AppData) => AppData, label?: string, tracked = false, parts: Part[] = TASK_PARTS) => {");
sub(S, "past.current[past.current.length - 1] !== d) {\n        past.current.push(d);", "past.current[past.current.length - 1]?.d !== d) {\n        past.current.push({ d, parts });");
sub(S, "labelOverride.current ?? label, tracked || !!labelOverride.current);", "labelOverride.current ?? label, tracked || !!labelOverride.current, ROUTINE_LOG_OPS.has(name) ? ['routineLog'] : TASK_PARTS);");
sub(S, "        const prev = past.current.pop();\n        if (prev) {\n          future.current.push(current.current);\n          setData(restoreSlice(prev));", "        const prev = past.current.pop();\n        if (prev) {\n          future.current.push({ d: current.current, parts: prev.parts });\n          setData(restore(prev));");
sub(S, "        const next = future.current.pop();\n        if (next) {\n          past.current.push(current.current);\n          setData(restoreSlice(next));", "        const next = future.current.pop();\n        if (next) {\n          past.current.push({ d: current.current, parts: next.parts });\n          setData(restore(next));");
