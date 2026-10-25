import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Note } from '../pages/Rituals';
import { RestControls } from './Controls';
import { isGentle, isPaused, nextUp, placeOn, progressOf, routinesFor, stepsFor } from '../lib/routines';
import { countdownText, daysUntil, lastDoneLabel } from '../lib/journal';
import { PARTS, MOODS, currentPart, partOf } from '../lib/types';


const ORDER = PARTS.map((p) => p.id);

/** One calm card: the next thing to do, one tap. */
export function DoNow() {
  const { data, today, toggleStep, toggleSkipStep } = useStore();
  if (isPaused(data.settings, today)) return null; // the rest controls below already say so
  const next = nextUp(data, today, currentPart(new Date().getHours()), ORDER);
  if (!next) {
    return routinesFor(data, today).some((r) => r.steps.length > 0) ? (
      <section className="card donow" aria-label="Routines tended">
        <p>🌸 Your routines are tended to for now.</p>
      </section>
    ) : null;
  }
  const { routine, step, part, progress } = next;
  return (
    <section className="card donow" aria-label="Do this now">
      <p className="eyebrow">{partOf(part).icon} {routine.name} · {progress.done}/{progress.total}</p>
      <p className="donow-step">{step.title}{step.optional ? ' (optional)' : ''}</p>
      {step.note && <p className="meta"><Note text={step.note} /></p>}
      <div className="actions left">
        <button className="btn primary" onClick={() => toggleStep(today, routine.id, step.id)} aria-label={`Done: ${step.title}`}>Done ✓</button>
        <button className="btn ghost" onClick={() => toggleSkipStep(today, routine.id, step.id)}>Skip today</button>
      </div>
    </section>
  );
}

/** Every routine for today, in order through the day, with checkboxes right here. */
export function TodaysRoutines() {
  const { data, today, toggleStep } = useStore();
  const now = currentPart(new Date().getHours());
  const gentle = isGentle(data.settings, today);
  const pool = routinesFor(data, today).filter((r) => stepsFor(r, today, gentle, placeOn(data.settings, today)).length > 0);
  const groups = PARTS.map((p) => ({ p, rs: pool.filter((r) => r.kind === p.id) })).filter((g) => g.rs.length > 0);
  return (
    <section className="card" aria-labelledby="tr-h">
      <h2 id="tr-h">Today's routines</h2>
      <RestControls />
      {gentle && <p className="hint">Gentle day: only the essentials are showing. Everything else is simply resting.</p>}
      {groups.map(({ p, rs }) =>
        rs.map((r) => {
          const pr = progressOf(data, r, today);
          return (
            <details key={r.id} open={p.id === now && !pr.complete}>
              <summary>
                {p.icon} <strong>{r.name}</strong>{' '}
                <span className="meta">
                  {pr.done}/{pr.total}
                  {pr.complete ? ' ✿' : ''}
                </span>
              </summary>
              <ul className="ritual-steps">
                {pr.steps.map((st) => (
                  <li key={st.id} className={pr.day.done.includes(st.id) ? 'done' : ''}>
                    <label>
                      <input type="checkbox" className="check" checked={pr.day.done.includes(st.id)} onChange={() => toggleStep(today, r.id, st.id)} />
                      <span>
                        {st.title}
                        {st.optional && <small> · optional</small>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          );
        }),
      )}
    </section>
  );
}

/** Small daily tallies, like glasses of water. Reaching the goal is a nice moment, never a requirement. */
export function Counters() {
  const { data, today, bumpCounter, addCounter, deleteCounter } = useStore();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [goal, setGoal] = useState('8');
  const [icon, setIcon] = useState('💧');
  const row = data.counterLog[today] ?? {};
  if (data.counters.length === 0 && !adding) {
    return (
      <section className="card" aria-label="Little counters">
        <h2>Little counters</h2>
        <p className="hint">Count small things through the day, like glasses of water.</p>
        <button className="btn small" onClick={() => setAdding(true)}>＋ Add a counter</button>
      </section>
    );
  }
  return (
    <section className="card" aria-labelledby="ct-h">
      <h2 id="ct-h">Little counters</h2>
      {data.counters.map((c) => {
        const n = row[c.id] ?? 0;
        return (
          <div key={c.id} className="counter">
            <span aria-hidden="true">{c.icon}</span>
            <span className="counter-label">
              {c.label} <strong>{n}</strong>
              <small> / {c.goal}{n >= c.goal ? ' ✿' : ''}</small>
            </span>
            <button className="btn small" onClick={() => bumpCounter(today, c.id, -1)} disabled={n === 0} aria-label={`One less ${c.label}`}>−</button>
            <button className="btn small primary" onClick={() => bumpCounter(today, c.id, 1)} aria-label={`One more ${c.label}`}>＋</button>
            <button className="btn ghost small" onClick={() => deleteCounter(c.id)} aria-label={`Remove counter ${c.label}`}>✕</button>
          </div>
        );
      })}
      {adding ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            addCounter(label.trim(), icon || '🌸', Number(goal) || 1);
            setLabel('');
            setAdding(false);
          }}
        >
          <input aria-label="Counter icon" value={icon} onChange={(e) => setIcon(e.target.value)} style={{ maxWidth: 64 }} />
          <input aria-label="Counter name" placeholder="Glasses of water" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input aria-label="Daily goal" type="number" min="1" value={goal} onChange={(e) => setGoal(e.target.value)} style={{ maxWidth: 80 }} />
          <button className="btn primary" type="submit">Add</button>
          <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button className="btn small" onClick={() => setAdding(true)}>＋ Add a counter</button>
      )}
    </section>
  );
}

/** A private one-tap "how did today feel" with an optional note. */
export function CheckIn() {
  const { data, today, setCheckin } = useStore();
  const c = data.checkins[today] ?? {};
  const [note, setNote] = useState(c.note ?? '');
  useEffect(() => setNote(c.note ?? ''), [today]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="card" aria-labelledby="ck-h">
      <h2 id="ck-h">How is today feeling?</h2>
      <div className="moods" role="radiogroup" aria-label="Mood">
        {MOODS.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={c.mood === m.id}
            className={'mood' + (c.mood === m.id ? ' on' : '')}
            onClick={() => setCheckin(today, { mood: c.mood === m.id ? undefined : m.id })}
            aria-label={m.label}
            title={m.label}
          >
            <span aria-hidden="true">{m.icon}</span>
          </button>
        ))}
      </div>
      <label>
        A line about today (optional, only you see it)
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (c.note ?? '') && setCheckin(today, { note })} />
      </label>
    </section>
  );
}



/** Things you do now and then, with the time you last did them. Your own record, not medical advice. */
export function AsNeeded() {
  const { data, markNeeded, unmarkNeeded, addNeeded, deleteNeeded } = useStore();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('🌿');
  const now = new Date();
  return (
    <section className="card" aria-labelledby="an-h">
      <h2 id="an-h">As needed</h2>
      <p className="hint">Things you do now and then. A quick tap remembers when. This is only your own record, not medical advice.</p>
      {data.needed.map((n) => {
        const log = data.neededLog[n.id] ?? [];
        const last = log[log.length - 1];
        const today = log.filter((t) => new Date(t).toDateString() === now.toDateString()).length;
        return (
          <div key={n.id} className="counter">
            <span aria-hidden="true">{n.icon}</span>
            <span className="counter-label">
              {n.label}
              <small> · {last ? `last ${lastDoneLabel(last, now)}` : 'not yet'}{today > 1 ? ` · ${today} today` : ''}</small>
            </span>
            <button className="btn small primary" onClick={() => markNeeded(n.id, new Date().toISOString())} aria-label={`Just did: ${n.label}`}>Just did it</button>
            <button className="btn ghost small" onClick={() => unmarkNeeded(n.id)} disabled={!last} aria-label={`Undo last ${n.label}`}>↺</button>
            <button className="btn ghost small" onClick={() => deleteNeeded(n.id)} aria-label={`Remove ${n.label}`}>✕</button>
          </div>
        );
      })}
      {adding ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            addNeeded(label.trim(), icon || '🌿');
            setLabel('');
            setAdding(false);
          }}
        >
          <input aria-label="As-needed icon" value={icon} onChange={(e) => setIcon(e.target.value)} style={{ maxWidth: 64 }} />
          <input aria-label="As-needed name" placeholder="Water the plants" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn primary" type="submit">Add</button>
          <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button className="btn small" onClick={() => setAdding(true)}>＋ Add an as-needed item</button>
      )}
    </section>
  );
}

/** "6 days until the trip". Disappears the day after. */
export function Countdowns() {
  const { data, today, addCountdown, deleteCountdown } = useStore();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('✈️');
  const [date, setDate] = useState('');
  const upcoming = data.countdowns.filter((c) => daysUntil(c.date, today) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length === 0 && !adding) {
    return (
      <section className="card" aria-label="Coming up">
        <h2>Coming up</h2>
        <button className="btn small" onClick={() => setAdding(true)}>＋ Add a countdown</button>
      </section>
    );
  }
  return (
    <section className="card" aria-labelledby="cd-h">
      <h2 id="cd-h">Coming up</h2>
      {upcoming.map((c) => (
        <div key={c.id} className="counter">
          <span aria-hidden="true">{c.icon}</span>
          <span className="counter-label">{countdownText(c.label, c.date, today)}</span>
          <button className="btn ghost small" onClick={() => deleteCountdown(c.id)} aria-label={`Remove countdown ${c.label}`}>✕</button>
        </div>
      ))}
      {adding ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim() || !date) return;
            addCountdown(label.trim(), icon || '🌸', date);
            setLabel('');
            setDate('');
            setAdding(false);
          }}
        >
          <input aria-label="Countdown icon" value={icon} onChange={(e) => setIcon(e.target.value)} style={{ maxWidth: 64 }} />
          <input aria-label="Countdown name" placeholder="The trip" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input aria-label="Countdown date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn primary" type="submit">Add</button>
          <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button className="btn small" onClick={() => setAdding(true)}>＋ Add a countdown</button>
      )}
    </section>
  );
}
