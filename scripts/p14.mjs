import { sub, append } from './lib.mjs';
const A = 'src/App.tsx';

// ---- nav + page
sub(A, "import { Shed } from './pages/Shed';", "import { Shed } from './pages/Shed';\nimport { Journal } from './pages/Journal';");
sub(A, "  { id: 'seeds', label: 'Seed Pouch', sub: 'Tasks', icon: '🌱' },", "  { id: 'seeds', label: 'Seed Pouch', sub: 'Tasks', icon: '🌱' },\n  { id: 'journal', label: 'Garden Journal', sub: 'Moods & notes', icon: '📖' },");
sub(A, "        {page === 'shed' && <Shed />}", "        {page === 'journal' && <Journal />}\n        {page === 'shed' && <Shed />}");

// ---- share target + weekly backup file
sub(A, "import { applyTextSize, getTextSize } from './lib/device';", "import { applyTextSize, autoBackupDue, getTextSize, markAutoBackup } from './lib/device';\nimport { exportJSON } from './lib/storage';\nimport { downloadText } from './lib/ics';\nimport { makeTask } from './lib/schedule';");
sub(A, "function Shell() {\n  const { data } = useStore();\n  useReminders();\n  useEffect(() => applyTextSize(getTextSize()), []);", `/** Text shared to Petalkeeper from another app lands in the Seed Pouch (Android, when installed). */
function useShareTarget(go: (id: PageId) => void) {
  const { addTask, notify } = useStore();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const title = (q.get('title') ?? '').trim();
    const text = (q.get('text') ?? '').trim();
    const link = (q.get('url') ?? '').trim();
    if (!title && !text && !link) return;
    const name = (title || text || link).split('\\n')[0].slice(0, 120);
    const notes = [text && text !== name ? text : '', link && link !== name ? link : ''].filter(Boolean).join('\\n');
    addTask(makeTask({ title: name, notes }));
    notify('Added to your Seed Pouch.');
    window.history.replaceState(null, '', window.location.pathname + '#/seeds');
    go('seeds');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/** If you've turned it on, saves a backup file to your downloads about once a week (desktop browsers). */
function useWeeklyBackup() {
  const { data, today, updateSettings } = useStore();
  useEffect(() => {
    if (!autoBackupDue(today)) return;
    try {
      downloadText(\`petalkeeper-backup-\${today}.json\`, exportJSON(data), 'application/json');
      markAutoBackup(today);
      updateSettings({ lastBackup: today });
    } catch {
      /* downloads blocked: the manual backup nudge still works */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function Shell() {
  const { data } = useStore();
  useReminders();
  useWeeklyBackup();
  useEffect(() => applyTextSize(getTextSize()), []);`);
sub(A, "  const go = (id: PageId) => {\n    window.location.hash = '#/' + id;\n    setPage(id);\n    window.scrollTo?.(0, 0);\n  };\n", "  const go = (id: PageId) => {\n    window.location.hash = '#/' + id;\n    setPage(id);\n    window.scrollTo?.(0, 0);\n  };\n  useShareTarget(go);\n");

// ---- device prefs: weekly backup
append('src/lib/device.ts', `
/* weekly backup file (opt in, per device) */
const AB_KEY = 'petalkeeper.autobackup';
/** stored value: "off", or the ISO date of the last automatic backup ("on" before the first one) */
export const autoBackupOn = () => {
  const v = read(AB_KEY);
  return v !== null && v !== 'off';
};
export const setAutoBackup = (on: boolean) => write(AB_KEY, on ? 'on' : null);
export function autoBackupDue(today: string): boolean {
  const v = read(AB_KEY);
  if (v === null || v === 'off') return false;
  if (v === 'on') return true;
  return (new Date(today).getTime() - new Date(v).getTime()) / 86_400_000 >= 7;
}
export const markAutoBackup = (today: string) => write(AB_KEY, today);
`);
sub('src/components/DevicePanel.tsx', "import { applyTextSize, getTextSize, hasPin,", "import { applyTextSize, autoBackupOn, getTextSize, hasPin, setAutoBackup,");
sub('src/components/DevicePanel.tsx', "  const [pinOn, setPinOn] = useState(hasPin);", "  const [pinOn, setPinOn] = useState(hasPin);\n  const [auto, setAuto] = useState(autoBackupOn);");
sub('src/components/DevicePanel.tsx', "      <fieldset className=\"pin\">", `      <label className="inline">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked);
            setAutoBackup(e.target.checked);
          }}
        />{' '}
        Save a backup file automatically about once a week
      </label>
      <p className="hint">A browser can't write to a folder quietly, so this downloads a backup file when you open the app and a week has passed. It works best on a computer. Phones may ask where to save it.</p>
      <fieldset className="pin">`);

// ---- manifest: share target
sub('public/manifest.webmanifest', '  "icons": [', '  "share_target": { "action": "./", "method": "GET", "params": { "title": "title", "text": "text", "url": "url" } },\n  "icons": [');

// ---- styles
append('src/styles.css', `
/* journal, places, notes */
.cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 10px; }
.cal-h { text-align: center; font-size: 0.8rem; color: var(--ink-soft); }
.cal-day { min-height: 52px; border-radius: 10px; border: 1px solid var(--sage, #a8b99a); background: transparent; display: grid; place-items: center; align-content: center; cursor: pointer; color: inherit; font: inherit; padding: 2px; }
.cal-day .n { font-size: 0.8rem; opacity: 0.8; }
.cal-day.out { opacity: 0.4; }
.cal-day.today { border-width: 2px; border-color: var(--moss, #687b5d); }
.cal-day.sel { background: var(--petal, #e8b8c4); color: #3a2630; }
.row.between { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.place-switch { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; margin: 6px 0; }
.step-note { display: inline-block; font-size: 0.9rem; opacity: 0.9; }
.step-note a { color: inherit; text-decoration: underline; }
.timing { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; margin: 4px 0; }
ul.plain { list-style: none; padding: 0; margin: 6px 0; display: grid; gap: 6px; }
.versions { list-style: none; padding: 0; display: grid; gap: 8px; }
.sync-more { margin-top: 10px; }
`);
