import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useUI } from '../ui';
import { TaskCard } from '../components/TaskCard';
import { occursOn, nextOccurrence } from '../lib/schedule';
import type { Task } from '../lib/types';

type Filter = 'all' | 'today' | 'upcoming' | 'overdue' | 'unscheduled' | 'completed';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'unscheduled', label: 'Unscheduled' },
  { id: 'completed', label: 'Completed' },
];

export function matches(t: Task, f: Filter, today: string): boolean {
  const recurring = !!t.recurrence;
  const open = recurring ? true : !t.done;
  switch (f) {
    case 'all':
      return recurring || !t.done;
    case 'today':
      return occursOn(t, today) || (!recurring && !t.done && t.due === today);
    case 'upcoming':
      return open && (recurring ? true : !!t.date && t.date > today);
    case 'overdue':
      return !recurring && !t.done && ((!!t.date && t.date < today) || (!!t.due && t.due < today));
    case 'unscheduled':
      return !recurring && !t.done && !t.date;
    case 'completed':
      return !recurring && t.done;
  }
}

export function Seeds() {
  const { data, today } = useStore();
  const { openForm } = useUI();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      data.tasks
        .filter((t) => {
          const query = q.trim().toLowerCase();
          if (query) return (t.title + ' ' + t.notes + ' ' + t.subtasks.map((x) => x.title).join(' ')).toLowerCase().includes(query);
          return matches(t, filter, today);
        })
        .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')),
    [data.tasks, filter, today, q],
  );

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Seed Pouch · tasks &amp; ideas waiting for a day</p>
        <h1>Seed Pouch</h1>
        <div className="actions left">
          <button className="btn primary" onClick={() => openForm()}>＋ Add a seed</button>
        </div>
        <label className="search">
          <span className="sr">Search tasks</span>
          <input type="search" placeholder="Search all tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="tabs" role="group" aria-label="Filter tasks">
          {FILTERS.map((f) => (
            <button key={f.id} className={'tab' + (filter === f.id ? ' on' : '')} aria-pressed={filter === f.id && !q} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </header>
      {list.length === 0 && (
        <p className="empty">
          {q ? 'Nothing matches that search.' : filter === 'all' || filter === 'unscheduled'
            ? 'Your seed pouch is empty. Add a task whenever you\'re ready.'
            : 'Nothing here right now. Your garden is at peace.'}
        </p>
      )}
      {list.map((t) => {
        const d = t.recurrence ? (nextOccurrence(t, today) ?? t.date ?? today) : (t.date ?? today);
        return <TaskCard key={t.id} occ={{ task: t, date: d, key: t.id }} showDate={!!t.date && !t.recurrence} />;
      })}
    </div>
  );
}
