import { useState } from 'react';
import { useStore } from '../store';
import { makeTask } from '../lib/schedule';
import { parseDateWords } from '../lib/dateWords';
import { fmtShort } from '../lib/dates';
import type { Recurrence } from '../lib/types';

const REPEATS: Array<['' | Recurrence['freq'], string]> = [['', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month']];

/**
 * A one-line way to add a to-do. Date words at the start or end of the text ("pay rent friday", "call mom tomorrow",
 * "renew in 2 weeks", "oct 20 dentist") set the day, unless a date was picked in the box.
 */
export function TodoQuickAdd() {
  const { addTask, today, notify } = useStore();
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [repeat, setRepeat] = useState<'' | Recurrence['freq']>('');

  const parsed = !date && text.trim() ? parseDateWords(text, today) : null;
  const when = date || parsed?.date || '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = (parsed?.title ?? text).trim();
    if (!title) return;
    addTask(makeTask({
      title: title.slice(0, 200),
      ...(when ? { date: when } : {}),
      ...(repeat ? { recurrence: { freq: repeat } } : {}),
    }));
    notify(when ? `Added for ${fmtShort(when)}.` : 'Added to your Seed Pouch.');
    setText('');
    setDate('');
    setRepeat('');
  };

  return (
    <form className="card quick-add" onSubmit={submit} aria-label="Add a to-do">
      <label className="grow">
        <span className="sr">What needs doing?</span>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs doing? Try “pay rent friday”" maxLength={200} autoComplete="off" />
      </label>
      <label>
        <span className="sr">Day (optional)</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Day (optional)" />
      </label>
      <label>
        <span className="sr">Repeat</span>
        <select value={repeat} onChange={(e) => setRepeat(e.target.value as '' | Recurrence['freq'])} aria-label="Repeat">
          {REPEATS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <button className="btn primary" type="submit" disabled={!text.trim()}>Add</button>
      {parsed && <p className="meta hint" role="status">“{parsed.title}” will be set for {fmtShort(parsed.date)}.</p>}
    </form>
  );
}
