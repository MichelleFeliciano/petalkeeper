import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { TaskCard } from './TaskCard';
import { itemsOn, isDone } from '../lib/schedule';
import { fmtLong } from '../lib/dates';
import { monthDays } from '../lib/todo';

const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** One month at a time. A dot marks a day with something open, a tick-dot a day where everything is finished. Tap a day to see it. */
export function MonthView() {
  const { data, today } = useStore();
  const { weekStart } = data.settings;
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [picked, setPicked] = useState<string>(today);

  const cells = useMemo(() => monthDays(cursor.y, cursor.m, weekStart), [cursor, weekStart]);
  const byDay = useMemo(() => {
    const out: Record<string, { open: number; done: number }> = {};
    for (const d of cells) {
      if (!d) continue;
      const its = itemsOn(data.tasks, d);
      if (its.length) out[d] = { open: its.filter((o) => !isDone(o.task, o.date)).length, done: its.filter((o) => isDone(o.task, o.date)).length };
    }
    return out;
  }, [cells, data.tasks]);

  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shift = (n: number) => setCursor((c) => {
    const d = new Date(c.y, c.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const heads = Array.from({ length: 7 }, (_, i) => NAMES[(weekStart + i) % 7]);
  const list = picked.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`) ? itemsOn(data.tasks, picked) : [];

  return (
    <section className="card month" aria-label="Month calendar">
      <div className="month-head">
        <button className="btn" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <h2 aria-live="polite">{title}</h2>
        <button className="btn" onClick={() => shift(1)} aria-label="Next month">›</button>
        <button className="btn ghost" onClick={() => { setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }); setPicked(today); }}>Today</button>
      </div>
      <div className="month-grid" role="group" aria-label={title}>
        {heads.map((h) => <span key={h} className="month-dow" aria-hidden="true">{h.slice(0, 1)}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const c = byDay[d];
          const label = `${fmtLong(d)}${c ? `, ${c.open} open, ${c.done} done` : ', nothing planned'}`;
          return (
            <button
              key={d}
              className={'month-day' + (d === today ? ' today' : '') + (d === picked ? ' on' : '')}
              aria-label={label}
              aria-pressed={d === picked}
              onClick={() => setPicked(d)}
            >
              {Number(d.slice(8))}
              <span className={'dot' + (c ? (c.open ? ' open' : ' all-done') : '')} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className="meta">A filled dot is something still to do that day. A hollow dot means everything is finished.</p>
      {picked && list.length > 0 ? (
        <div>
          <h3>{fmtLong(picked)}</h3>
          {list.map((o) => <TaskCard key={o.key} occ={o} />)}
        </div>
      ) : (
        <p className="empty">{picked.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`) ? `Nothing planned for ${fmtLong(picked)}.` : 'Tap a day to see what is planned.'}</p>
      )}
    </section>
  );
}
