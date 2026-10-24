import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useUI } from '../ui';
import { TaskCard } from '../components/TaskCard';
import { findConflicts, isDone, itemsOn, type Occurrence } from '../lib/schedule';
import { addDays, DAY_NAMES, fmtLong, fmtShort, fmtTime, weekDates, weekday } from '../lib/dates';
import { CATEGORIES } from '../lib/types';

export function Path() {
  const { data, today, moveOccurrence } = useStore();
  const { openForm } = useUI();
  const { weekStart, defaultDuration, buffer } = data.settings;
  const [anchor, setAnchor] = useState(today);
  const [mode, setMode] = useState<'week' | 'agenda'>('week');
  const dates = weekDates(anchor, weekStart);

  const byDay = useMemo(
    () =>
      Object.fromEntries(
        dates.map((d) => {
          const its = itemsOn(data.tasks, d);
          return [d, { its, bad: findConflicts(its, defaultDuration, buffer) }];
        }),
      ),
    [data.tasks, dates.join(), defaultDuration, buffer], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const moveSelect = (o: Occurrence) => (
    <label className="move">
      <span className="sr">Move {o.task.title} to another day</span>
      <select
        value=""
        onChange={(e) => e.target.value && moveOccurrence(o.task.id, o.date, { date: e.target.value })}
      >
        <option value="">Move to…</option>
        {dates.filter((d) => d !== o.date).map((d) => (
          <option key={d} value={d}>{DAY_NAMES[weekday(d)]} {fmtShort(d)}</option>
        ))}
        <option value={addDays(dates[6], 1)}>Next week ({fmtShort(addDays(dates[6], 1))})</option>
      </select>
    </label>
  );

  return (
    <div className="page wide">
      <header>
        <p className="eyebrow">The Garden Path · your week</p>
        <h1>{fmtShort(dates[0])} – {fmtShort(dates[6])}</h1>
        <div className="actions left">
          <button className="btn" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Previous week">‹ Prev</button>
          <button className="btn" onClick={() => setAnchor(today)}>This week</button>
          <button className="btn" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Next week">Next ›</button>
          <div className="tabs inline" role="group" aria-label="View">
            <button className={'tab' + (mode === 'week' ? ' on' : '')} aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Week</button>
            <button className={'tab' + (mode === 'agenda' ? ' on' : '')} aria-pressed={mode === 'agenda'} onClick={() => setMode('agenda')}>Agenda</button>
          </div>
          <button className="btn primary" onClick={() => openForm(undefined, { date: dates.includes(today) ? today : dates[0], category: 'appointment' })}>＋ Add</button>
        </div>
      </header>

      {mode === 'week' ? (
        <div className="week-grid">
          {dates.map((d) => {
            const { its, bad } = byDay[d];
            return (
              <section key={d} className={'day-col card' + (d === today ? ' today' : '')} aria-label={fmtLong(d)}>
                <h2>
                  {DAY_NAMES[weekday(d)].slice(0, 3)} <small>{fmtShort(d)}</small>
                  {d === today && <span className="badge ok"> today</span>}
                </h2>
                {its.length === 0 && <p className="empty small">Open space 🌿</p>}
                {its.map((o) => {
                  const cat = CATEGORIES.find((c) => c.id === o.task.category);
                  return (
                    <div key={o.key} className={'mini' + (isDone(o.task, o.date) ? ' done' : '') + (bad.has(o.key) ? ' conflict' : '')}>
                      <button className="mini-title" onClick={() => openForm(o.task)} aria-label={`Edit ${o.task.title}`}>
                        <span aria-hidden="true">{cat?.icon}</span> {o.task.start && <b>{fmtTime(o.task.start)} </b>}
                        {o.task.title}
                        {isDone(o.task, o.date) && ' ✓'}
                      </button>
                      {bad.has(o.key) && <span className="badge warn">Overlap</span>}
                      {moveSelect(o)}
                    </div>
                  );
                })}
                <button className="btn ghost small" onClick={() => openForm(undefined, { date: d })} aria-label={`Add to ${DAY_NAMES[weekday(d)]}`}>＋ Add</button>
              </section>
            );
          })}
        </div>
      ) : (
        <div>
          {dates.map((d) => {
            const { its, bad } = byDay[d];
            return (
              <section key={d} aria-label={fmtLong(d)}>
                <h2>{fmtLong(d)}{d === today && <span className="badge ok"> today</span>}</h2>
                {its.length === 0 ? <p className="empty">Open space — leave it flexible.</p> : its.map((o) => <TaskCard key={o.key} occ={o} conflict={bad.has(o.key)} extra={moveSelect(o)} />)}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
