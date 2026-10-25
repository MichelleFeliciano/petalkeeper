import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Modal } from '../components/Modal';
import { routineDay } from '../lib/ops';
import { newId, routineDaysLabel, routineOn } from '../lib/schedule';
import { addDays, fmtDuration } from '../lib/dates';
import { atPlace, historyFor, isGentle, isPaused, placeLabel, placeOn, progressOf, recentTended, STARTERS, stepsFor } from '../lib/routines';
import { linkify, typicalMinutes } from '../lib/journal';
import { PlaceSwitcher, RestControls } from '../components/Controls';
import type { Place } from '../lib/types';
import { PARTS, currentPart, partOf, type PartOfDay, type Routine } from '../lib/types';

const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Bed({ done, total }: { done: number; total: number }) {
  // little flowers that appear as steps are finished
  return (
    <span className="bed" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < done ? 'bloom on' : 'bloom'}>
          {i < done ? '✿' : '·'}
        </span>
      ))}
    </span>
  );
}

function DayChips({ days, onChange, weekStart, label, suffix = '' }: { days?: number[]; onChange: (d: number[]) => void; weekStart: 0 | 1; label: string; suffix?: string }) {
  return (
    <fieldset className="day-chips">
      <legend>{label}</legend>
      {(weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]).map((n) => {
        const on = days?.includes(n) ?? false;
        return (
          <label key={n} className={'chip' + (on ? ' on' : '')}>
            <input type="checkbox" aria-label={DAY_LONG[n] + suffix} checked={on} onChange={() => onChange(on ? (days ?? []).filter((x) => x !== n) : [...(days ?? []), n])} />
            {DAY_LONG[n].slice(0, 3)}
          </label>
        );
      })}
    </fieldset>
  );
}

function PlaceChips({ places, value, onChange, label, suffix = '' }: { places: Place[]; value?: string[]; onChange: (v: string[]) => void; label: string; suffix?: string }) {
  return (
    <fieldset className="day-chips">
      <legend>{label}</legend>
      {places.map((p) => {
        const on = value?.includes(p.id) ?? false;
        return (
          <label key={p.id} className={'chip' + (on ? ' on' : '')}>
            <input type="checkbox" aria-label={p.label + suffix} checked={on} onChange={() => onChange(on ? (value ?? []).filter((x) => x !== p.id) : [...(value ?? []), p.id])} />
            {p.icon} {p.label}
          </label>
        );
      })}
    </fieldset>
  );
}

/** note text with links and phone numbers made tappable; nothing is ever rendered as HTML */
export function Note({ text }: { text: string }) {
  return (
    <span className="step-note">
      {linkify(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target={p.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{p.text}</a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

function Guided({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const s = useStore();
  const { data, today } = s;
  const day = routineDay(data, today, routine.id);
  const remaining = stepsFor(routine, today, isGentle(data.settings, today), placeOn(data.settings, today)).filter((st) => !day.done.includes(st.id) && !day.skipped.includes(st.id));
  const [offset, setOffset] = useState(0);
  const cur = remaining.length ? remaining[offset % remaining.length] : undefined;
  const [left, setLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setLeft(cur?.minutes ? cur.minutes * 60 : null);
    setRunning(false);
  }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running || left === null) return;
    const t = setInterval(() => setLeft((l) => (l !== null && l > 0 ? l - 1 : l)), 1000);
    return () => clearInterval(t);
  }, [running, left === null]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title={routine.name} onClose={onClose}>
      {!cur ? (
        <>
          <p>Everything in this routine is tended to. 🌸</p>
          <div className="actions"><button className="btn primary" onClick={onClose}>Close</button></div>
        </>
      ) : (
        <>
          <p className="meta">{remaining.length} step{remaining.length === 1 ? '' : 's'} left. Take them one at a time.</p>
          <p className="guided-step">{cur.title}{cur.optional ? ' (optional)' : ''}</p>
          {left !== null && (
            <p className="guided-timer" aria-live="off">
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}{' '}
              <button className="btn small" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Start timer'}</button>
            </p>
          )}
          <div className="actions">
            <button className="btn ghost" onClick={() => s.toggleSkipStep(today, routine.id, cur.id)}>Skip today</button>
            {remaining.length > 1 && <button className="btn" onClick={() => setOffset(offset + 1)}>Not yet</button>}
            <button className="btn primary" onClick={() => s.toggleStep(today, routine.id, cur.id)}>Done ✓</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function History({ routine }: { routine: Routine }) {
  const { data, today } = useStore();
  // four weeks ending today, oldest first
  const dates = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
  const marks = historyFor(data, routine, dates);
  const r = recentTended(data, routine, today);
  const text = r.scheduled === 0 ? 'Nothing scheduled in the last week.' : `Tended on ${r.tended} of the last ${r.scheduled} scheduled day${r.scheduled === 1 ? '' : 's'}.`;
  return (
    <details className="history">
      <summary>Last four weeks · {text}</summary>
      <div className="hist-grid" role="img" aria-label={`Last four weeks. ${text}`}>
        {marks.map((m, i) => (
          <span key={dates[i]} className={'hist ' + m} title={`${dates[i]}: ${m === 'all' ? 'all done' : m === 'some' ? 'some done' : m === 'none' ? 'not today' : 'not scheduled'}`}>
            {m === 'all' ? '✿' : m === 'some' ? '❀' : ''}
          </span>
        ))}
      </div>
      <p className="hint">✿ everything done · ❀ some done · empty days are just resting. No streaks here.</p>
    </details>
  );
}

function RoutineCard({ routine, first, last }: { routine: Routine; first: boolean; last: boolean }) {
  const s = useStore();
  const { data, today } = s;
  const gentle = isGentle(data.settings, today);
  const day = routineDay(data, today, routine.id);
  const pr = progressOf(data, routine, today);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [guided, setGuided] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [newStep, setNewStep] = useState('');
  const [mins, setMins] = useState('');
  const place = placeOn(data.settings, today);
  const here = atPlace(routine, place);
  const todays = stepsFor(routine, today, gentle, place);
  const typical = typicalMinutes(data, routine.id);
  const shown = editing ? routine.steps : todays;
  const hidden = routine.steps.length - todays.length;
  const total = routine.steps.reduce((n, st) => n + (st.minutes ?? 0), 0);
  const weekStart = data.settings.weekStart;

  const patchStep = (id: string, patch: Partial<Routine['steps'][number]>) =>
    s.setSteps(routine.id, routine.steps.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const move = (i: number, dir: -1 | 1) => {
    const steps = [...routine.steps];
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    s.setSteps(routine.id, steps);
  };

  const add = () => {
    const t = newStep.trim();
    if (!t) return;
    const m = parseInt(mins, 10);
    s.setSteps(routine.id, [...routine.steps, { id: newId(), title: t, ...(m > 0 ? { minutes: m } : {}) }]);
    setNewStep('');
    setMins('');
  };

  return (
    <section className="card routine" aria-label={routine.name}>
      <div className="routine-head">
        {editing ? (
          <input aria-label="Routine name" value={routine.name} onChange={(e) => s.renameRoutine(routine.id, e.target.value)} />
        ) : (
          <h2>{routine.name}</h2>
        )}
        {routine.days && routine.days.length > 0 && <span className="badge">{routineDaysLabel(routine.days)}</span>}
        {routine.places && routine.places.length > 0 && <span className="badge">{routine.places.map((id) => placeLabel(data.settings, id)?.label ?? '').filter(Boolean).join(', ')}</span>}
        {!routineOn(routine, today) && <span className="meta">Not on today's list</span>}
        {routineOn(routine, today) && !here && <span className="meta">Not for {placeLabel(data.settings, place)?.label ?? 'here'}</span>}
        <span className="meta">
          {pr.done}/{pr.total} done{total > 0 ? ` · about ${fmtDuration(total)}` : ''}
        </span>
        <Bed done={pr.done} total={pr.total} />
        <button className="btn small" onClick={() => setGuided(true)}>Guide me</button>
        <button className="btn ghost" onClick={() => setEditing(!editing)}>
          {editing ? 'Done editing' : 'Edit'}
        </button>
      </div>
      {!editing && (
        <p className="timing meta">
          {!day.start && (
            <button className="btn ghost small" onClick={() => s.startRoutine(today, routine.id, new Date().toISOString())}>▶ Start</button>
          )}
          {day.start && !day.end && (
            <>
              Started {new Date(day.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{' '}
              <button className="btn small" onClick={() => s.finishRoutine(today, routine.id, new Date().toISOString())}>Finished</button>
            </>
          )}
          {day.start && day.end && (
            <>
              Took about {Math.max(1, Math.round((new Date(day.end).getTime() - new Date(day.start).getTime()) / 60000))} min today.{' '}
              <button className="btn ghost small" onClick={() => s.startRoutine(today, routine.id, new Date().toISOString())}>Start again</button>
            </>
          )}
          {typical && <>Usually about {typical.minutes} min (last {typical.samples} times). Just for your curiosity.</>}
        </p>
      )}
      {gentle && hidden > 0 && !editing && <p className="hint">Gentle day: {hidden} step{hidden === 1 ? ' is' : 's are'} resting today.</p>}
      <ol className="ritual-steps">
        {shown.map((st, i) => {
          const isDone = day.done.includes(st.id);
          const isSkipped = day.skipped.includes(st.id);
          return (
            <li
              key={st.id}
              className={(isDone ? 'done' : isSkipped ? 'skipped' : '') + (dragIdx === i ? ' dragging' : '')}
              onDragOver={(e) => editing && e.preventDefault()}
              onDrop={() => {
                if (dragIdx === null || dragIdx === i) return;
                const steps = [...routine.steps];
                const [m] = steps.splice(dragIdx, 1);
                steps.splice(i, 0, m);
                s.setSteps(routine.id, steps);
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
            >
              {editing && (
                <span className="step-handle" draggable onDragStart={() => setDragIdx(i)} title="Drag to reorder" aria-hidden="true">
                  ⠿
                </span>
              )}
              <label>
                <input type="checkbox" className="check" checked={isDone} disabled={isSkipped} onChange={() => s.toggleStep(today, routine.id, st.id)} />
                <span>
                  {editing ? (
                    <input aria-label={`Step ${i + 1} name`} value={st.title} onChange={(e) => patchStep(st.id, { title: e.target.value })} />
                  ) : (
                    st.title
                  )}
                  {st.minutes ? <small> · {st.minutes} min</small> : null}
                  {st.optional && <small> · optional</small>}
                  {st.essential && !editing && <small> · ★</small>}
                  {st.days && st.days.length > 0 && <small> · {routineDaysLabel(st.days)}</small>}
                  {isSkipped && <small> · skipped for today</small>}
                  {isDone && <small> ✓</small>}
                  {st.note && !editing && <><br /><Note text={st.note} /></>}
                </span>
              </label>
              {editing ? (
                <span className="step-actions">
                  <button className="btn ghost" aria-pressed={!!st.essential} onClick={() => patchStep(st.id, { essential: !st.essential })} aria-label={`${st.title}: essential on gentle days`} title="Essential on gentle days">
                    {st.essential ? '★' : '☆'}
                  </button>
                  <button className="btn ghost" aria-pressed={!!st.optional} onClick={() => patchStep(st.id, { optional: !st.optional })} aria-label={`${st.title}: optional`} title="Optional">
                    {st.optional ? '◔ optional' : '○'}
                  </button>
                  <button className="btn ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${st.title} up`}>↑</button>
                  <button className="btn ghost" onClick={() => move(i, 1)} disabled={i === routine.steps.length - 1} aria-label={`Move ${st.title} down`}>↓</button>
                  <button className="btn ghost" onClick={() => s.setSteps(routine.id, routine.steps.filter((x) => x.id !== st.id))} aria-label={`Remove ${st.title}`}>✕</button>
                </span>
              ) : (
                <button className="btn ghost" onClick={() => s.toggleSkipStep(today, routine.id, st.id)}>
                  {isSkipped ? 'Bring back' : 'Skip today'}
                </button>
              )}
              {editing && (
                <details className="step-days">
                  <summary>Note and places for “{st.title}”</summary>
                  <label>
                    Note (a link, address or phone number is fine)
                    <input aria-label={`Note for ${st.title}`} value={st.note ?? ''} onChange={(e) => patchStep(st.id, { note: e.target.value || undefined })} />
                  </label>
                  <PlaceChips suffix={` for ${st.title}`} places={data.settings.places} value={st.places} label="Only in these places (none = wherever the routine runs)" onChange={(v) => patchStep(st.id, { places: v.length ? v : undefined })} />
                </details>
              )}
              {editing && (
                <details className="step-days">
                  <summary>Days for “{st.title}”: {routineDaysLabel(st.days)}</summary>
                  <DayChips suffix={` for ${st.title}`} days={st.days} weekStart={weekStart} label="Only on these days (none = whenever the routine runs)" onChange={(d) => patchStep(st.id, { days: d.length ? d : undefined })} />
                </details>
              )}
            </li>
          );
        })}
      </ol>
      {routine.steps.length === 0 && <p className="empty">No steps yet. Add the first little one below.</p>}
      {editing && (
        <>
          <div className="row">
            <input aria-label="New step name" placeholder="New step" value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <input aria-label="Minutes (optional)" type="number" min="1" placeholder="min" value={mins} onChange={(e) => setMins(e.target.value)} style={{ maxWidth: 90 }} />
            <button className="btn" onClick={add}>Add step</button>
          </div>
          <p className="hint">★ keeps a step on gentle days. “optional” steps never stop a routine from counting as done.</p>
          <DayChips days={routine.days} weekStart={weekStart} label="Which days is this routine for? (none picked = every day)" onChange={(d) => s.setRoutineDays(routine.id, d)} />
          <PlaceChips places={data.settings.places} value={routine.places} label="Which places is this routine for? (none picked = everywhere)" onChange={(v) => s.setRoutinePlaces(routine.id, v)} />
          <div className="actions left">
            {data.settings.places.map((p) => (
              <button key={p.id} className="btn small" onClick={() => s.copyToPlace(routine.id, p.id)} aria-label={`Make a copy of ${routine.name} just for ${p.label}`}>
                Copy for {p.icon} {p.label}
              </button>
            ))}
          </div>
          <label className="inline">
            Part of the day{' '}
            <select value={routine.kind} onChange={(e) => s.setRoutineKind(routine.id, e.target.value as PartOfDay)}>
              {PARTS.map((p) => (
                <option key={p.id} value={p.id}>{p.icon} {p.label} · {p.hint}</option>
              ))}
            </select>
          </label>
          <label className="inline">
            Calendar nudge time (optional){' '}
            <input type="time" aria-label="Calendar nudge time" value={routine.remindAt ?? ''} onChange={(e) => s.setRoutineRemind(routine.id, e.target.value || undefined)} />
          </label>
          <div className="actions left">
            <button className="btn small" onClick={() => s.moveRoutine(routine.id, -1)} disabled={first} aria-label={`Move ${routine.name} up`}>Move routine up</button>
            <button className="btn small" onClick={() => s.moveRoutine(routine.id, 1)} disabled={last} aria-label={`Move ${routine.name} down`}>Move routine down</button>
            <button className="btn small" onClick={() => s.duplicateRoutine(routine.id)}>Duplicate</button>
            <button className="btn danger small" onClick={() => setConfirmDel(true)}>Delete this routine</button>
          </div>
        </>
      )}
      {!editing && <History routine={routine} />}
      {guided && <Guided routine={routine} onClose={() => setGuided(false)} />}
      {confirmDel && (
        <Modal title="Delete routine?" onClose={() => setConfirmDel(false)}>
          <p><strong>{routine.name}</strong> and its steps will be removed.</p>
          <div className="actions">
            <button className="btn" onClick={() => setConfirmDel(false)}>Keep it</button>
            <button className="btn danger" onClick={() => s.deleteRoutine(routine.id)}>Delete</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function Rituals() {
  const { data, addRoutine, addStarter, today } = useStore();
  // open on the current part of the day, or the next one that has a routine in it
  const [kind, setKind] = useState<PartOfDay>(() => {
    const at = PARTS.findIndex((p) => p.id === currentPart(new Date().getHours()));
    const order = [...PARTS.slice(at), ...PARTS.slice(0, at)];
    return (order.find((p) => data.routines.some((r) => r.kind === p.id)) ?? order[0]).id;
  });
  const list = data.routines.filter((r) => r.kind === kind);
  const part = partOf(kind);
  const count = (k: string) => data.routines.filter((r) => r.kind === k).length;
  const paused = isPaused(data.settings, today);

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Daily Rituals · routines for each part of your day</p>
        <h1>{part.label} flowerbed</h1>
        <p className="hint">
          {part.hint}. Routines follow the part of the day, not the clock, so there's no set time. Checklists reset each day. Skip anything you like; nothing is lost. Medication items are just your own reminders, not medical advice.
        </p>
        <div className="tabs" role="tablist" aria-label="Part of the day">
          {PARTS.map((p) => (
            <button key={p.id} role="tab" aria-selected={kind === p.id} className={'tab' + (kind === p.id ? ' on' : '')} onClick={() => setKind(p.id)}>
              {p.icon} {p.label}
              {count(p.id) > 0 ? ` (${count(p.id)})` : ''}
            </button>
          ))}
        </div>
      </header>
      <PlaceSwitcher />
      <RestControls />
      {paused && <p className="hint">Routines are paused, so they're hidden on Today. You can still edit them here.</p>}
      {list.map((r, i) => <RoutineCard key={r.id} routine={r} first={i === 0} last={i === list.length - 1} />)}
      {list.length === 0 && <p className="empty">No {part.label.toLowerCase()} routine yet. Plant one whenever you like, or start from a ready-made one below.</p>}
      <div className="actions left">
        <button className="btn primary" onClick={() => addRoutine(kind, `New ${part.label.toLowerCase()} routine`)}>
          ＋ New {part.label.toLowerCase()} routine
        </button>
        <label className="inline">
          Start from a ready-made one{' '}
          <select
            aria-label="Start from a ready-made routine"
            value=""
            onChange={(e) => {
              const st = STARTERS.find((x) => x.name === e.target.value);
              if (st) {
                addStarter(st);
                setKind(st.kind);
              }
            }}
          >
            <option value="">Choose…</option>
            {STARTERS.map((st) => (
              <option key={st.name} value={st.name}>{partOf(st.kind).icon} {st.name} — {st.blurb}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
