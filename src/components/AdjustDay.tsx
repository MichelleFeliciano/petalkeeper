import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useStore } from '../store';
import { findConflicts, isDone, itemsOn, type Occurrence } from '../lib/schedule';
import { addDays, fmtShort, fmtTime, fromMinutes, nowMinutes } from '../lib/dates';
import * as ops from '../lib/ops';
import type { AppData } from '../lib/types';

type Choice = 'keep' | 'later' | 'tomorrow' | 'date' | 'leave';
interface Plan {
  choice: Choice;
  time: string;
  date: string;
}

function target(p: Plan, today: string): ops.MoveTarget | null {
  switch (p.choice) {
    case 'keep':
      return null;
    case 'later':
      return { date: today, start: p.time };
    case 'tomorrow':
      return { date: addDays(today, 1) };
    case 'date':
      return { date: p.date || addDays(today, 2) };
    case 'leave':
      return {};
  }
}

export function AdjustDay({ items, onClose }: { items: Occurrence[]; onClose: () => void }) {
  const { data, today, moveOccurrence } = useStore();
  const { defaultDuration, buffer } = data.settings;
  const [bufferOn, setBufferOn] = useState(buffer > 0);
  const gap = buffer > 0 ? buffer : 10;
  const laterDefault = fromMinutes(Math.ceil((nowMinutes() + 30) / 15) * 15);
  const [plans, setPlans] = useState<Record<string, Plan>>(() =>
    Object.fromEntries(items.map((o) => [o.key, { choice: 'keep' as Choice, time: laterDefault, date: addDays(today, 2) }])),
  );
  const set = (k: string, p: Partial<Plan>) => setPlans((s) => ({ ...s, [k]: { ...s[k], ...p } }));

  const changes = items.filter((o) => plans[o.key].choice !== 'keep');

  // Preview the result before anything is applied.
  const { warnings } = useMemo(() => {
    let d: AppData = data;
    const dates = new Set<string>([today]);
    for (const o of changes) {
      const t = target(plans[o.key], today);
      if (t) {
        d = ops.moveOccurrence(d, o.task.id, o.date, t);
        if (t.date) dates.add(t.date);
      }
    }
    const warn: string[] = [];
    for (const day of dates) {
      const its = itemsOn(d.tasks, day);
      const bad = findConflicts(its, defaultDuration, bufferOn ? gap : 0);
      if (bad.size) {
        const names = its.filter((o) => bad.has(o.key)).map((o) => `${o.task.title}${o.task.start ? ' (' + fmtTime(o.task.start) + ')' : ''}`);
        warn.push(`${fmtShort(day)}: ${names.join(' · ')}`);
      }
    }
    return { warnings: warn };
  }, [plans, bufferOn, data, today, defaultDuration, gap]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = () => {
    for (const o of changes) {
      const t = target(plans[o.key], today);
      if (t) moveOccurrence(o.task.id, o.date, t);
    }
    onClose();
  };

  return (
    <Modal title="Adjust My Day" onClose={onClose} wide>
      <p className="hint">Take a little breathing room. Nothing changes until you confirm, and nothing is ever deleted here.</p>
      {items.length === 0 ? (
        <p>Everything is tended to. Your garden will be here when you return.</p>
      ) : (
        <ul className="adjust-list">
          {items.map((o) => {
            const p = plans[o.key];
            return (
              <li key={o.key} className="card">
                <div>
                  <strong>{o.task.title}</strong>
                  <div className="meta">
                    {o.date !== today && <span>from {fmtShort(o.date)}</span>}
                    {o.task.start && <span>{fmtTime(o.task.start)}</span>}
                  </div>
                </div>
                <div className="row">
                  <label>
                    What would you like to do?
                    <select value={p.choice} onChange={(e) => set(o.key, { choice: e.target.value as Choice })}>
                      <option value="keep">Keep as it is</option>
                      <option value="later">Move to later today</option>
                      <option value="tomorrow">Move to tomorrow</option>
                      <option value="date">Reschedule this task…</option>
                      <option value="leave">Leave for another day</option>
                    </select>
                  </label>
                  {p.choice === 'later' && (
                    <label>
                      Time
                      <input type="time" value={p.time} onChange={(e) => set(o.key, { time: e.target.value })} />
                    </label>
                  )}
                  {p.choice === 'date' && (
                    <label>
                      Date
                      <input type="date" value={p.date} min={today} onChange={(e) => set(o.key, { date: e.target.value })} />
                    </label>
                  )}
                </div>
                {p.choice === 'leave' && <p className="hint">It will rest in your Seed Pouch (or skip just this day if it repeats).</p>}
              </li>
            );
          })}
        </ul>
      )}
      <label className="inline">
        <input type="checkbox" checked={bufferOn} onChange={(e) => setBufferOn(e.target.checked)} /> Leave {gap} minutes of breathing room between activities
      </label>
      {warnings.length > 0 && (
        <div className="notice" role="status">
          <strong>Heads up, these would overlap:</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <span className="hint">You can still apply — or pick another time.</span>
        </div>
      )}
      <div className="actions">
        <button className="btn" onClick={onClose}>
          Not now
        </button>
        <button className="btn primary" onClick={apply} disabled={changes.length === 0}>
          Apply {changes.length > 0 ? `${changes.length} change${changes.length > 1 ? 's' : ''}` : 'changes'}
        </button>
      </div>
    </Modal>
  );
}

export function leftover(tasksItems: Occurrence[]) {
  return tasksItems.filter((o) => !isDone(o.task, o.date));
}
