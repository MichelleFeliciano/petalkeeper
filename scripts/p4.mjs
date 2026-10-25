import { sub, append } from './lib.mjs';

// ---- App: lock, tour, text size, sync chip
const A = 'src/App.tsx';
sub(A, "import { SyncProvider } from './sync';", "import { SyncProvider, useSync } from './sync';\nimport { LockGate, Tour } from './components/Gate';\nimport { applyTextSize, getTextSize } from './lib/device';");
sub(A, "function Shell() {\n  const { data } = useStore();\n  useReminders();",
`/** A small "is my other device up to date?" line under the menu. Tap it to open the sync settings. */
function SyncChip({ onOpen }: { onOpen: () => void }) {
  const sync = useSync();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!sync.config) return null;
  const mins = sync.lastSync ? Math.floor((Date.now() - new Date(sync.lastSync).getTime()) / 60000) : null;
  const text =
    sync.status === 'syncing' ? 'Syncing…' : sync.status === 'error' ? 'Sync problem. Tap to see' : mins === null ? 'Sync is on' : mins < 1 ? 'Synced just now' : \`Synced \${mins} min ago\`;
  return (
    <button className={'sync-chip' + (sync.status === 'error' ? ' bad' : '')} onClick={onOpen} aria-label={\`Sync status: \${text}. Open sync settings\`}>
      <span aria-hidden="true">{sync.status === 'error' ? '⚠️' : '☁️'}</span> {text}
    </button>
  );
}

function Shell() {
  const { data } = useStore();
  useReminders();
  useEffect(() => applyTextSize(getTextSize()), []);`);
sub(A, "        </nav>\n      </aside>", "        </nav>\n        <SyncChip onOpen={() => go('shed')} />\n      </aside>");
sub(A, "      <ToastBar />\n    </div>", "      <ToastBar />\n      <Tour />\n    </div>");
sub(A, "          <Shell />", "          <LockGate>\n            <Shell />\n          </LockGate>");

// ---- tests: skip the welcome tour
sub('src/test/setup.ts', "afterEach(() => {", "beforeEach(() => {\n  localStorage.setItem('petalkeeper.toured', '1');\n});\nafterEach(() => {");
sub('src/test/setup.ts', "import { afterEach } from 'vitest';", "import { afterEach, beforeEach } from 'vitest';");

// ---- Shed: device panel + routine calendar export
const S = 'src/pages/Shed.tsx';
sub(S, "import { SyncPanel } from '../components/SyncPanel';", "import { SyncPanel } from '../components/SyncPanel';\nimport { DevicePanel } from '../components/DevicePanel';\nimport { buildRoutineICS } from '../lib/routines';");
sub(S, "      <SyncPanel />\n", "      <SyncPanel />\n\n      <DevicePanel />\n");
sub(S, "          <input\n            ref={fileRef}", `          <button
            className="btn"
            onClick={() => {
              const { text, count } = buildRoutineICS(s.data.routines, todayISO());
              if (count === 0) return setMsg({ ok: false, text: 'No routine has a calendar nudge time yet. Edit a routine and set one.' });
              downloadText('petalkeeper-routine-nudges.ics', text, 'text/calendar');
              setMsg({ ok: true, text: \`Saved \${count} repeating reminder\${count === 1 ? '' : 's'}. Open the file to add them to your phone's calendar.\` });
            }}
          >
            Export routine nudges (.ics)
          </button>
          <input
            ref={fileRef}`);

// ---- summary: mood + routine consistency
const M = 'src/lib/summary.ts';
sub(M, "  message: string;\n}", "  message: string;\n  /** how many days had a mood logged, and the most common one */\n  moodDays: number;\n  commonMood?: number;\n  /** routines completed on the days they were scheduled */\n  routinesComplete: number;\n  routinesScheduled: number;\n}");
sub(M, "import type { AppData } from './types';", "import { progressOf, routinesFor } from './routines';\nimport type { AppData } from './types';");
sub(M, "  const message =", `  const moods: Record<number, number> = {};
  let moodDays = 0;
  for (const date of dates) {
    const m = d.checkins[date]?.mood;
    if (m) {
      moodDays++;
      moods[m] = (moods[m] ?? 0) + 1;
    }
  }
  const commonMood = Number(Object.entries(moods).sort((a, b) => b[1] - a[1])[0]?.[0]) || undefined;
  let routinesComplete = 0;
  let routinesScheduled = 0;
  for (const date of dates) {
    for (const r of routinesFor(d, date)) {
      const pr = progressOf(d, r, date);
      if (pr.total === 0) continue;
      routinesScheduled++;
      if (pr.complete) routinesComplete++;
    }
  }
  const message =`);
sub(M, "  return { done, total, routineSteps, byCategory, message };", "  return { done, total, routineSteps, byCategory, message, moodDays, commonMood, routinesComplete, routinesScheduled };");
sub('src/pages/Path.tsx', "      <p>{w.message}</p>", `      {w.routinesScheduled > 0 && <p className="meta">Routines finished on {w.routinesComplete} of {w.routinesScheduled} scheduled days. Partial days count too.</p>}
      {w.moodDays > 0 && w.commonMood && <p className="meta">Most days felt {MOODS.find((m) => m.id === w.commonMood)?.label.toLowerCase()} {MOODS.find((m) => m.id === w.commonMood)?.icon} ({w.moodDays} check-in{w.moodDays === 1 ? '' : 's'}).</p>}
      <p>{w.message}</p>`);
