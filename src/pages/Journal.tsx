import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { MOODS } from '../lib/types';
import { addDays, fmtLong, fromISO, toISO, weekDates } from '../lib/dates';
import { counterDay, weekdayInsight } from '../lib/journal';
import { progressOf, routinesFor } from '../lib/routines';

const firstOf = (iso: string) => {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
};
const shiftMonth = (iso: string, by: number) => {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + by, 1));
};

/** A calendar of how days felt, with the notes you wrote. Private; edit any day. */
export function Journal() {
  const { data, today, setCheckin } = useStore();
  const [month, setMonth] = useState(firstOf(today));
  const [sel, setSel] = useState(today);
  const [q, setQ] = useState('');
  const c = data.checkins[sel] ?? {};
  const [note, setNote] = useState(c.note ?? '');
  useEffect(() => setNote(data.checkins[sel]?.note ?? ''), [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const weeks = useMemo(() => {
    const out: string[][] = [];
    let cursor = weekDates(month, data.settings.weekStart);
    const monthNo = fromISO(month).getMonth();
    for (let i = 0; i < 6; i++) {
      out.push(cursor);
      const next = addDays(cursor[6], 1);
      if (fromISO(next).getMonth() !== monthNo) break;
      cursor = weekDates(next, data.settings.weekStart);
    }
    return out;
  }, [month, data.settings.weekStart]);
  const monthNo = fromISO(month).getMonth();
  const title = fromISO(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dayNames = weeks[0].map((d) => fromISO(d).toLocaleDateString(undefined, { weekday: 'short' }));

  const found = q.trim()
    ? Object.entries(data.checkins)
        .filter(([, v]) => v.note?.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 30)
    : [];
  const insight = weekdayInsight(data, today);
  const done = routinesFor(data, sel)
    .map((r) => ({ r, pr: progressOf(data, r, sel) }))
    .filter((x) => x.pr.total > 0);
  const counts = counterDay(data, sel);

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Garden Journal · how your days have felt</p>
        <h1>Garden Journal</h1>
        <p className="hint">Private notes and moods, only for you. Nothing here is scored, and any day can be filled in later.</p>
      </header>

      {insight && (
        <section className="card" aria-label="A gentle observation">
          <p>💭 {insight}</p>
        </section>
      )}

      <section className="card" aria-label="Month">
        <div className="row between">
          <button className="btn small" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <h2>{title}</h2>
          <button className="btn small" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
        </div>
        <div className="cal" role="grid" aria-label={title}>
          {dayNames.map((n) => (
            <span key={n} className="cal-h" role="columnheader">{n}</span>
          ))}
          {weeks.flat().map((d) => {
            const mood = data.checkins[d]?.mood;
            const out = fromISO(d).getMonth() !== monthNo;
            return (
              <button
                key={d}
                role="gridcell"
                className={'cal-day' + (d === sel ? ' sel' : '') + (d === today ? ' today' : '') + (out ? ' out' : '')}
                onClick={() => setSel(d)}
                aria-label={`${fmtLong(d)}${mood ? ', ' + MOODS.find((m) => m.id === mood)?.label : ''}${data.checkins[d]?.note ? ', has a note' : ''}`}
                aria-pressed={d === sel}
              >
                <span className="n">{fromISO(d).getDate()}</span>
                <span aria-hidden="true">{mood ? MOODS.find((m) => m.id === mood)?.icon : data.checkins[d]?.note ? '·' : ''}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card" aria-labelledby="jd-h">
        <h2 id="jd-h">{fmtLong(sel)}</h2>
        <div className="moods" role="radiogroup" aria-label="Mood for this day">
          {MOODS.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={c.mood === m.id}
              className={'mood' + (c.mood === m.id ? ' on' : '')}
              onClick={() => setCheckin(sel, { mood: c.mood === m.id ? undefined : m.id })}
              aria-label={m.label}
              title={m.label}
            >
              <span aria-hidden="true">{m.icon}</span>
            </button>
          ))}
        </div>
        <label>
          Note for this day
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (c.note ?? '') && setCheckin(sel, { note })} />
        </label>
        {(done.length > 0 || counts.length > 0) && (
          <p className="meta">
            {done.map((x) => `${x.r.name}: ${x.pr.done}/${x.pr.total}`).join(' · ')}
            {done.length > 0 && counts.length > 0 ? ' · ' : ''}
            {counts.map((x) => `${x.counter.icon} ${x.counter.label}: ${x.n}`).join(' · ')}
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="js-h">
        <h2 id="js-h">Search your notes</h2>
        <input type="search" aria-label="Search notes" placeholder="Search what you wrote" value={q} onChange={(e) => setQ(e.target.value)} />
        {q.trim() && found.length === 0 && <p className="empty">Nothing matches yet.</p>}
        <ul className="plain">
          {found.map(([d, v]) => (
            <li key={d}>
              <button className="btn ghost" onClick={() => { setSel(d); setMonth(firstOf(d)); }}>
                {fmtLong(d)} {v.mood ? MOODS.find((m) => m.id === v.mood)?.icon : ''}
              </button>{' '}
              <span className="meta">{v.note?.slice(0, 120)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
