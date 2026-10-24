import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { useStore } from '../store';
import { makeTask, newId } from '../lib/schedule';
import { toMinutes, fromMinutes } from '../lib/dates';
import { allCategories, type Category, type Priority, type RecurFreq, type Task } from '../lib/types';

const DAY_LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TaskForm({ task, defaults, occurrenceDate, onClose }: { task?: Task; defaults?: Partial<Task>; occurrenceDate?: string; onClose: () => void }) {
  const { addTask, updateTask, splitOccurrence, data } = useStore();
  const init = task ?? defaults ?? {};
  const [title, setTitle] = useState(init.title ?? '');
  const [notes, setNotes] = useState(init.notes ?? '');
  const [category, setCategory] = useState<Category>(init.category ?? 'other');
  const [priority, setPriority] = useState<Priority>(init.priority ?? 'normal');
  const [date, setDate] = useState(occurrenceDate ?? init.date ?? '');
  const [start, setStart] = useState(init.start ?? '');
  const [end, setEnd] = useState(init.end ?? '');
  const [duration, setDuration] = useState(init.duration ? String(init.duration) : '');
  const [due, setDue] = useState(init.due ?? '');
  const [freq, setFreq] = useState<RecurFreq | 'none'>(init.recurrence?.freq ?? 'none');
  const [days, setDays] = useState<number[]>(init.recurrence?.days ?? []);
  const [until, setUntil] = useState(init.recurrence?.until ?? '');
  const [subs, setSubs] = useState(init.subtasks ?? []);
  const [newSub, setNewSub] = useState('');
  const [error, setError] = useState('');

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    setSubs([...subs, { id: newId(), title: t, done: false }]);
    setNewSub('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Please give this a name.');
    if (start && end && toMinutes(end) <= toMinutes(start)) return setError('The end time should come after the start time.');
    if (!occurrenceDate && freq !== 'none' && !date) return setError('Pick a start date for something that repeats.');
    if (freq === 'days' && days.length === 0) return setError('Choose at least one day of the week.');
    if (until && date && until < date) return setError('The end date should not be before the start date.');
    let dur = duration ? Math.max(1, parseInt(duration, 10) || 0) : undefined;
    if (start && end) dur = toMinutes(end) - toMinutes(start);
    // a time without a date still needs a place to live: default to today only if a time was given
    const patch: Partial<Task> = {
      title: title.trim(),
      notes,
      category,
      priority,
      date: date || undefined,
      start: start || undefined,
      end: end || undefined,
      duration: dur,
      due: due || undefined,
      subtasks: subs,
      recurrence: freq === 'none' ? undefined : { freq, days: freq === 'days' ? days : undefined, until: until || undefined },
    };
    if (task && occurrenceDate) splitOccurrence(task.id, occurrenceDate, { ...patch, recurrence: undefined });
    else if (task) updateTask(task.id, patch);
    else addTask(makeTask({ ...patch, title: title.trim() }));
    onClose();
  };

  const suggestEnd = () => {
    if (start && !end) {
      const d = duration ? parseInt(duration, 10) : data.settings.defaultDuration;
      if (d) setEnd(fromMinutes(toMinutes(start) + d));
    }
  };

  return (
    <Modal title={occurrenceDate ? 'Edit just this day' : task ? 'Edit activity' : 'Add to your garden'} onClose={onClose} wide>
      <form onSubmit={submit} className="form" noValidate>
        {task?.recurrence && !occurrenceDate && <p className="hint">This repeats, so changes here apply to the whole series.</p>}
        {occurrenceDate && <p className="hint">Only this day changes. The rest of the series stays as it is.</p>}
        <label>
          Name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What would you like to tend to?" />
        </label>
        <div className="row">
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {allCategories(data.settings).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>When (all optional)</legend>
          <div className="row">
            <label>
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Start time
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} onBlur={suggestEnd} />
            </label>
            <label>
              End time
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <label>
              Minutes
              <input type="number" min="1" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={String(data.settings.defaultDuration)} />
            </label>
          </div>
          <label>
            Due by
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </fieldset>
        {!occurrenceDate && (
        <fieldset>
          <legend>Repeat</legend>
          <label>
            Repeats
            <select value={freq} onChange={(e) => setFreq(e.target.value as RecurFreq | 'none')}>
              <option value="none">Doesn't repeat</option>
              <option value="daily">Every day</option>
              <option value="days">On selected days</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          {freq === 'days' && (
            <div className="chips" role="group" aria-label="Days of the week">
              {DAY_LETTERS.map((n, i) => (
                <label key={n} className={'chip' + (days.includes(i) ? ' on' : '')}>
                  <input
                    type="checkbox"
                    checked={days.includes(i)}
                    onChange={() => setDays(days.includes(i) ? days.filter((d) => d !== i) : [...days, i])}
                  />
                  {n}
                </label>
              ))}
            </div>
          )}
          {freq !== 'none' && (
            <label>
              Last day (optional)
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </label>
          )}
        </fieldset>
        )}
        <fieldset>
          <legend>Smaller steps</legend>
          <ul className="sublist">
            {subs.map((s) => (
              <li key={s.id}>
                <span>{s.title}</span>
                <button type="button" className="btn ghost" aria-label={`Remove step ${s.title}`} onClick={() => setSubs(subs.filter((x) => x.id !== s.id))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="row">
            <input
              aria-label="New step"
              value={newSub}
              placeholder="Add a small step"
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSub();
                }
              }}
            />
            <button type="button" className="btn" onClick={addSub}>
              Add step
            </button>
          </div>
        </fieldset>
        <label>
          Notes
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {task ? 'Save changes' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
