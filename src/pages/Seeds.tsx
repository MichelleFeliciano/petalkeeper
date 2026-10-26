import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useUI } from '../ui';
import { TaskCard } from '../components/TaskCard';
import { TodoQuickAdd } from '../components/TodoQuickAdd';
import { occursOn, nextOccurrence } from '../lib/schedule';
import { TODO_SORTS, canSnooze, reorder, snoozeTo, sortTodos, stepTask, type TodoSort } from '../lib/todo';
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

const SORT_KEY = 'petalkeeper.seedsSort';
function loadSort(): TodoSort {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return TODO_SORTS.some(([k]) => k === v) ? (v as TodoSort) : 'date_asc';
  } catch {
    return 'date_asc';
  }
}

export function Seeds() {
  const { data, today, undo, redo, canUndo, canRedo, updateTask, toggleDone, deleteTask, snoozeTask, setOrder } = useStore();
  const { openForm, askDelete } = useUI();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [sort, setSortState] = useState<TodoSort>(loadSort);
  const dragId = useRef<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const setSort = (s: TodoSort) => {
    setSortState(s);
    try { localStorage.setItem(SORT_KEY, s); } catch { /* the choice just is not remembered */ }
  };

  const list = useMemo(
    () =>
      sortTodos(
        data.tasks.filter((t) => {
          const query = q.trim().toLowerCase();
          if (query) return (t.title + ' ' + t.notes + ' ' + t.subtasks.map((x) => x.title).join(' ')).toLowerCase().includes(query);
          return matches(t, filter, today);
        }),
        sort,
        today,
      ),
    [data.tasks, filter, today, q, sort],
  );
  const ids = list.map((t) => t.id);
  const manual = sort === 'manual';
  const dayOf = (t: Task) => (t.recurrence ? (nextOccurrence(t, today) ?? t.date ?? today) : (t.date ?? t.due ?? today));
  const apply = (updates: Array<{ id: string; order: number }>) => updates.length && setOrder(updates);

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Seed Pouch · your to-do list: tasks &amp; ideas waiting for a day</p>
        <h1>Seed Pouch</h1>
        <TodoQuickAdd />
        <div className="todo-tools">
          <button className="btn" onClick={() => openForm()}>＋ Add with details</button>
          <button className="btn ghost" onClick={undo} disabled={!canUndo}>↶ Undo</button>
          <button className="btn ghost" onClick={redo} disabled={!canRedo}>↷ Redo</button>
          <label className="inline">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as TodoSort)} aria-label="Sort tasks">
              {TODO_SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
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
        const d = dayOf(t);
        const mover = manual && (
          <span className="snooze">
            <button className="btn small" onClick={() => apply(stepTask(ids, t.id, -1))} aria-label={`Move ${t.title} up`}>↑</button>
            <button className="btn small" onClick={() => apply(stepTask(ids, t.id, 1))} aria-label={`Move ${t.title} down`}>↓</button>
          </span>
        );
        const snooze = canSnooze(t, today) && (
          <span className="snooze">
            <button className="btn small" onClick={() => snoozeTask(t.id, d, snoozeTo(today, 'tomorrow'))} aria-label={`Put off ${t.title} until tomorrow`}>Tomorrow</button>
            <button className="btn small" onClick={() => snoozeTask(t.id, d, snoozeTo(today, 'week'))} aria-label={`Put off ${t.title} until next week`}>Next week</button>
          </span>
        );
        return (
          <div
            key={t.id}
            className={'todo-row' + (dropOn === t.id ? ' drop-target' : '')}
            onDragOver={(e) => { if (manual) { e.preventDefault(); setDropOn(t.id); } }}
            onDragLeave={() => setDropOn((c) => (c === t.id ? null : c))}
            onDrop={() => {
              setDropOn(null);
              if (manual && dragId.current && dragId.current !== t.id) apply(reorder(ids, dragId.current, ids.indexOf(t.id)));
              dragId.current = null;
            }}
          >
            {manual && (
              <span className="drag-handle" draggable onDragStart={() => { dragId.current = t.id; }} title="Drag to move" aria-hidden="true">
                ⠿ drag
              </span>
            )}
            <TaskCard
              occ={{ task: t, date: d, key: t.id }}
              showDate={!!(t.date ?? t.due) && !t.recurrence}
              onRename={(title) => updateTask(t.id, { title })}
              onSwipe={(dir) => (dir === 'right' ? toggleDone(t.id, d) : t.recurrence ? askDelete(t, d) : deleteTask(t.id))}
              extra={(mover || snooze) ? <>{snooze}{mover}</> : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
