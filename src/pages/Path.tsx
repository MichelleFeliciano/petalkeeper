import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useUI } from '../ui';
import { TaskCard } from '../components/TaskCard';
import { MonthView } from '../components/MonthView';
import { findConflicts, isDone, itemsOn, type Occurrence } from '../lib/schedule';
import { addDays, DAY_NAMES, fmtLong, fmtShort, fmtTime, weekDates, weekday } from '../lib/dates';
import { categoryOf } from '../lib/types';
import { buildICS, downloadText } from '../lib/ics';
import { weekSummary } from '../lib/summary';
import { allCategories, MOODS } from '../lib/types';

function WeekReview({ dates }: { dates: string[] }) {
  const { data } = useStore();
  const w = weekSummary(data, dates);
  const cats = allCategories(data.settings).filter((c) => w.byCategory[c.id]);
  return (
    <section className="card review" aria-label="Week in review">
      <h2>Week in review</h2>
      <p>
        {w.done} of {w.total} activities tended
        {w.routineSteps > 0 ? ` · ${w.routineSteps} routine steps` : ''}
      </p>
      {cats.length > 0 && <p className="meta">{cats.map((c) => `${c.icon} ${c.label}: ${w.byCategory[c.id]}`).join('  ·  ')}</p>}
      {w.routinesScheduled > 0 && <p className="meta">Routines fully finished {w.routinesComplete} of {w.routinesScheduled} times they were scheduled. Partway counts too.</p>}
      {w.moodDays > 0 && w.commonMood && <p className="meta">Most days felt {MOODS.find((m) => m.id === w.commonMood)?.label.toLowerCase()} {MOODS.find((m) => m.id === w.commonMood)?.icon} ({w.moodDays} check-in{w.moodDays === 1 ? '' : 's'}).</p>}
      <p>{w.message}</p>
    </section>
  );
}

export function Path() {
  const { data, today, moveOccurrence } = useStore();
  const { openForm } = useUI();
  const { weekStart, defaultDuration, buffer } = data.settings;
  const [anchor, setAnchor] = useState(today);
  const [mode, setMode] = useState<'week' | 'agenda' | 'month'>('week');
  const [review, setReview] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
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
        <h1>{mode === 'month' ? 'Month' : `${fmtShort(dates[0])} – ${fmtShort(dates[6])}`}</h1>
        <div className="actions left">
          {mode !== 'month' && (
            <>
              <button className="btn" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Previous week">‹ Prev</button>
              <button className="btn" onClick={() => setAnchor(today)}>This week</button>
              <button className="btn" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Next week">Next ›</button>
            </>
          )}
          <div className="tabs inline" role="group" aria-label="View">
            <button className={'tab' + (mode === 'week' ? ' on' : '')} aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Week</button>
            <button className={'tab' + (mode === 'agenda' ? ' on' : '')} aria-pressed={mode === 'agenda'} onClick={() => setMode('agenda')}>Agenda</button>
            <button className={'tab' + (mode === 'month' ? ' on' : '')} aria-pressed={mode === 'month'} onClick={() => setMode('month')}>Month</button>
          </div>
          {mode !== 'month' && <button className="btn ghost" onClick={() => setReview(!review)} aria-expanded={review}>Week in review</button>}
          <button className="btn ghost" onClick={() => downloadText(`petalkeeper-week-${dates[0]}.ics`, buildICS(data.tasks, dates[0], 7, defaultDuration), 'text/calendar')}>Add to calendar (.ics)</button>
          <button className="btn ghost" onClick={() => window.print()}>Print</button>
          <button className="btn primary" onClick={() => openForm(undefined, { date: dates.includes(today) ? today : dates[0], category: 'appointment' })}>＋ Add</button>
        </div>
      </header>

      {review && <WeekReview dates={dates} />}
      {mode === 'month' ? (
        <MonthView />
      ) : mode === 'week' ? (
        <div className="week-grid">
          {dates.map((d) => {
            const { its, bad } = byDay[d];
            return (
              <section
                key={d}
                className={'day-col card' + (d === today ? ' today' : '') + (dragOver === d ? ' drop' : '')}
                aria-label={fmtLong(d)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(d);
                }}
                onDragLeave={() => setDragOver((c) => (c === d ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const [id, from] = e.dataTransfer.getData('text/plain').split('|');
                  if (id && from && from !== d) moveOccurrence(id, from, { date: d });
                }}
              >
                <h2>
                  {DAY_NAMES[weekday(d)].slice(0, 3)} <small>{fmtShort(d)}</small>
                  {d === today && <span className="badge ok"> today</span>}
                </h2>
                {its.length === 0 && <p className="empty small">Open space 🌿</p>}
                {its.map((o) => {
                  const cat = categoryOf(data.settings, o.task.category);
                  return (
                    <div
                      key={o.key}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', `${o.task.id}|${o.date}`)}
                      className={'mini' + (isDone(o.task, o.date) ? ' done' : '') + (bad.has(o.key) ? ' conflict' : '')}
                    >
                      <button className="mini-title" onClick={() => openForm(o.task)} aria-label={`Edit ${o.task.title}`}>
                        <span aria-hidden="true">{cat.icon}</span> {o.task.start && <b>{fmtTime(o.task.start)} </b>}
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
