import { sub } from './lib.mjs';

const ST = 'src/store.tsx';
sub(ST, "import { todayISO } from './lib/dates';", "import { todayISO } from './lib/dates';\nimport { isBack, loadTrash, restoreInto, saveTrash, trashEntryFor, type TrashEntry, type TrashKind } from './lib/trash';");

sub(ST, "  canUndo: boolean;\n  canRedo: boolean;",
  "  canUndo: boolean;\n  canRedo: boolean;\n  /** recent changes that Undo can take back, newest first */\n  history: { text: string; at: number }[];\n  /** things deleted in the last 30 days (on this device) that can be brought back */\n  trash: TrashEntry[];\n  restoreDeleted: (id: string) => void;\n  discardDeleted: (id: string) => void;\n  emptyTrash: () => void;");

sub(ST, "  importTasks: 'Brought in.',\n};",
  "  importTasks: 'Brought in.',\n  deleteCounter: 'Counter removed.',\n  deleteNeeded: 'Removed.',\n  deleteCountdown: 'Countdown removed.',\n};\n\n/** the same changes as a line in the History list */\nconst HISTORY_TEXT: Record<string, string> = {\n  deleteTask: 'Removed a task',\n  deleteOccurrence: 'Removed one day of a repeating task',\n  moveOccurrence: 'Moved a task',\n  copyDay: 'Copied a day',\n  deleteRoutine: 'Removed a routine',\n  applyTemplate: 'Added a template',\n  splitOccurrence: 'Changed one day of a repeating task',\n  deleteTemplate: 'Removed a template',\n  snoozeTask: 'Put a task off for later',\n  importTasks: 'Brought in tasks',\n  deleteCounter: 'Removed a counter',\n  deleteNeeded: 'Removed an as-needed item',\n  deleteCountdown: 'Removed a countdown',\n  addTask: 'Added a task',\n  updateTask: 'Edited a task',\n  duplicateTask: 'Copied a task',\n  toggleDone: 'Checked a task off or back on',\n  toggleSubtask: 'Checked a small step',\n  setOrder: 'Re-ordered tasks',\n  toggleStep: 'Ticked a routine step',\n  toggleSkipStep: 'Skipped a routine step',\n};\n\n/** deleting these puts a copy in Recently deleted */\nconst TRASHED: Record<string, TrashKind> = { deleteTask: 'task', deleteRoutine: 'routine', deleteTemplate: 'template', deleteCounter: 'counter', deleteNeeded: 'needed', deleteCountdown: 'countdown' };\n\n/** which parts of the data a step brings back, when it isn't tasks, routines and templates */\nconst OWN_PARTS: Record<string, Part[]> = { deleteCounter: ['counters'], deleteNeeded: ['needed', 'neededLog'], deleteCountdown: ['countdowns'] };");

sub(ST, "type Part = 'tasks' | 'routines' | 'templates' | 'routineLog';\ninterface Entry {", "type Part = 'tasks' | 'routines' | 'templates' | 'routineLog' | 'counters' | 'needed' | 'neededLog' | 'countdowns';\ninterface Entry {\n  /** what the change was, for the History list */\n  text: string;\n  at: number;");

sub(ST, "  const [toast, setToast] = useState<Toast | null>(null);", "  const [toast, setToast] = useState<Toast | null>(null);\n  const [trash, setTrash] = useState<TrashEntry[]>(() => loadTrash());");

sub(ST, "(fn: (d: AppData) => AppData, label?: string, tracked = false, parts: Part[] = TASK_PARTS) => {", "(fn: (d: AppData) => AppData, label?: string, tracked = false, parts: Part[] = TASK_PARTS, text = 'Changed something') => {");
sub(ST, "past.current.push({ d, parts });", "past.current.push({ d, parts, text, at: Date.now() });");

sub(ST, "      w[name] = (...args: unknown[]) =>\n        apply((d) => (fn as (d: AppData, ...a: unknown[]) => AppData)(d, ...args), labelOverride.current ?? label, tracked || !!labelOverride.current, ROUTINE_LOG_OPS.has(name) ? ['routineLog'] : TASK_PARTS);",
  "      w[name] = (...args: unknown[]) => {\n        const kind = TRASHED[name];\n        const gone = kind && typeof args[0] === 'string' ? trashEntryFor(current.current, kind, args[0]) : null;\n        if (gone) setTrash((t) => saveTrash([gone, ...t]));\n        apply(\n          (d) => (fn as (d: AppData, ...a: unknown[]) => AppData)(d, ...args),\n          labelOverride.current ?? label,\n          tracked || !!labelOverride.current,\n          ROUTINE_LOG_OPS.has(name) ? ['routineLog'] : OWN_PARTS[name] ?? TASK_PARTS,\n          labelOverride.current ?? HISTORY_TEXT[name],\n        );\n      };");

sub(ST, "      canUndo: past.current.length > 0,\n      canRedo: future.current.length > 0,",
  "      canUndo: past.current.length > 0,\n      canRedo: future.current.length > 0,\n      history: [...past.current].reverse().map((e) => ({ text: e.text, at: e.at })),\n      // anything Undo already brought back is not listed twice\n      trash: trash.filter((e) => !isBack(data, e)),\n      restoreDeleted: (id: string) => {\n        const e = trash.find((x) => x.id === id);\n        if (!e) return;\n        apply((d) => restoreInto(d, e), undefined, true, e.kind === 'counter' ? ['counters'] : e.kind === 'needed' ? ['needed', 'neededLog'] : e.kind === 'countdown' ? ['countdowns'] : TASK_PARTS, `Brought back “${e.title}”`);\n        setTrash((t) => saveTrash(t.filter((x) => x.id !== id)));\n        setToast({ id: ++toastId, text: `Brought back “${e.title}”.`, undoable: false });\n      },\n      discardDeleted: (id: string) => setTrash((t) => saveTrash(t.filter((x) => x.id !== id))),\n      emptyTrash: () => setTrash(saveTrash([])),");

sub(ST, "  }, [data, today, saveFailed, toast, apply]);", "  }, [data, today, saveFailed, toast, trash, apply]);");

// export format: say which app and version made the file, and when
sub('src/lib/storage.ts', "export function exportJSON(data: AppData): string {\n  return JSON.stringify(data, null, 2);\n}", "/** `version` is the file format. The app name, app version and date say where the file came from. */\nexport function exportJSON(data: AppData): string {\n  return JSON.stringify({ app: 'petalkeeper', appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined, exportedAt: new Date().toISOString(), ...data }, null, 2);\n}");

// service worker cache is named after the app version
sub('public/sw.js', "const CACHE = 'petalkeeper-v3';", "// the build replaces the version below with the app version, so the cache and the app always match\nconst CACHE = 'petalkeeper-v__APP_VERSION__';");
sub('vite.config.ts', "    {\n      // lets the app ask", "    {\n      // names the offline cache after the app version\n      name: 'sw-cache-version',\n      apply: 'build',\n      closeBundle() {\n        const f = resolve(outDir, 'sw.js');\n        if (existsSync(f)) writeFileSync(f, readFileSync(f, 'utf8').replace('__APP_VERSION__', version));\n      },\n    },\n    {\n      // lets the app ask");
sub('vite.config.ts', "import pkg from './package.json';", "import pkg from './package.json';\nimport { existsSync, readFileSync, writeFileSync } from 'node:fs';\nimport { resolve } from 'node:path';");
sub('vite.config.ts', "const build = new Date().toISOString();", "const build = new Date().toISOString();\nconst outDir = 'dist';");

sub('package.json', '"version": "1.6.1"', '"version": "1.7.0"');
