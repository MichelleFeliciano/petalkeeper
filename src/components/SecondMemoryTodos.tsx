import { useState } from 'react';
import { useStore } from '../store';
import { SECOND_MEMORY_TODOS_KEY, extractTodos, planTodoCopy, type CopyPlan } from '../lib/secondMemoryImport';

/** The biggest export file read (a Second Memory export is far smaller). */
const MAX_BYTES = 5 * 1024 * 1024;

/** Copy the to-do list from the Second Memory app into the Seed Pouch, once. Nothing already here is changed or replaced. */
export function SecondMemoryTodos() {
  const { data, importTasks, notify } = useStore();
  const [plan, setPlan] = useState<CopyPlan | null>(null);
  const [error, setError] = useState('');

  // when Second Memory was used in this same browser, its to-dos are already here to read
  let onThisBrowser = 0;
  try {
    onThisBrowser = (extractTodos(JSON.parse(localStorage.getItem(SECOND_MEMORY_TODOS_KEY) ?? 'null')) ?? []).filter((r) => (r as { deleted?: unknown }).deleted !== true).length;
  } catch { /* none found */ }

  const preview = (records: ReturnType<typeof extractTodos>) => {
    setError('');
    if (!records) { setPlan(null); return setError('That doesn’t look like a Second Memory export. In Second Memory use “Export data” and choose that file.'); }
    if (!records.length) { setPlan(null); return setError('That file has no to-dos in it.'); }
    setPlan(planTodoCopy(records, data.tasks.map((t) => t.id)));
  };
  const fromFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError('That file is too large to be a Second Memory export.');
    try { preview(extractTodos(JSON.parse(await file.text()))); }
    catch { setPlan(null); setError('Couldn’t read that file. Pick the .json file from Second Memory’s “Export data”.'); }
  };
  const fromBrowser = () => {
    try { preview(extractTodos(JSON.parse(localStorage.getItem(SECOND_MEMORY_TODOS_KEY) ?? 'null'))); }
    catch { setPlan(null); setError('Couldn’t read Second Memory’s to-dos on this browser.'); }
  };
  const copy = () => {
    if (!plan?.fresh.length) return;
    const n = plan.fresh.length;
    importTasks(plan.fresh);
    notify(`Brought in ${n} to-do${n === 1 ? '' : 's'} from Second Memory.`);
    setPlan(null);
  };

  const open = plan?.fresh.filter((t) => !t.done).length ?? 0;
  const repeating = plan?.fresh.filter((t) => t.recurrence).length ?? 0;

  return (
    <section className="card form" aria-labelledby="smt-h">
      <h2 id="smt-h">Bring in to-dos from Second Memory</h2>
      <p className="hint">
        A one-time copy; the two apps are not connected afterwards. In Second Memory choose <strong>Export data</strong>, then pick that file here.
        To-dos keep their day, their repeat, whether they are finished, and their order. Doing it again never duplicates: anything already here is skipped, and nothing you have here is changed.
      </p>
      <div className="actions left">
        <label className="btn">
          Choose the export file
          <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {onThisBrowser > 0 && <button className="btn" onClick={fromBrowser}>Use the {onThisBrowser} to-do{onThisBrowser === 1 ? '' : 's'} found in this browser</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {plan && !error && (
        <div role="status">
          <p>
            <strong>{plan.fresh.length}</strong> to-do{plan.fresh.length === 1 ? '' : 's'} to bring in ({open} open{repeating ? `, ${repeating} repeating` : ''}, {plan.fresh.length - open} finished)
            {plan.alreadyHere > 0 && <>, {plan.alreadyHere} already here (skipped)</>}
            {plan.unreadable.length > 0 && <>, {plan.unreadable.length} that couldn’t be read: {plan.unreadable.slice(0, 5).join(', ')}</>}.
          </p>
          {plan.fresh.length > 0 && <button className="btn primary" onClick={copy}>Bring in {plan.fresh.length} to-do{plan.fresh.length === 1 ? '' : 's'}</button>}
        </div>
      )}
    </section>
  );
}
