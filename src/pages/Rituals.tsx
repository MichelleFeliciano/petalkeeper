import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Modal } from '../components/Modal';
import { routineDay } from '../lib/ops';
import { newId } from '../lib/schedule';
import { fmtDuration } from '../lib/dates';
import type { Routine } from '../lib/types';

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

function Guided({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const s = useStore();
  const { data, today } = s;
  const day = routineDay(data, today, routine.id);
  const remaining = routine.steps.filter((st) => !day.done.includes(st.id) && !day.skipped.includes(st.id));
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
          <p className="guided-step">{cur.title}</p>
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

function RoutineCard({ routine }: { routine: Routine }) {
  const s = useStore();
  const { data, today } = s;
  const day = routineDay(data, today, routine.id);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [guided, setGuided] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [newStep, setNewStep] = useState('');
  const [mins, setMins] = useState('');
  const active = routine.steps.filter((st) => !day.skipped.includes(st.id));
  const done = active.filter((st) => day.done.includes(st.id)).length;
  const total = routine.steps.reduce((n, st) => n + (st.minutes ?? 0), 0);

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
        <span className="meta">
          {done}/{active.length} done{total > 0 ? ` · about ${fmtDuration(total)}` : ''}
        </span>
        <Bed done={done} total={active.length} />
        <button className="btn small" onClick={() => setGuided(true)}>Guide me</button>
        <button className="btn ghost" onClick={() => setEditing(!editing)}>
          {editing ? 'Done editing' : 'Edit'}
        </button>
      </div>
      <ol className="ritual-steps">
        {routine.steps.map((st, i) => {
          const isDone = day.done.includes(st.id);
          const isSkipped = day.skipped.includes(st.id);
          return (
            <li
              key={st.id}
              className={(isDone ? 'done' : isSkipped ? 'skipped' : '') + (dragIdx === i ? ' dragging' : '')}
              draggable={editing}
              onDragStart={() => setDragIdx(i)}
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
              <label>
                <input type="checkbox" className="check" checked={isDone} disabled={isSkipped} onChange={() => s.toggleStep(today, routine.id, st.id)} />
                <span>
                  {editing ? (
                    <input
                      aria-label={`Step ${i + 1} name`}
                      value={st.title}
                      onChange={(e) => s.setSteps(routine.id, routine.steps.map((x) => (x.id === st.id ? { ...x, title: e.target.value } : x)))}
                    />
                  ) : (
                    st.title
                  )}
                  {st.minutes ? <small> · {st.minutes} min</small> : null}
                  {isSkipped && <small> · skipped for today</small>}
                  {isDone && <small> ✓</small>}
                </span>
              </label>
              {editing ? (
                <span className="step-actions">
                  <button className="btn ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${st.title} up`}>↑</button>
                  <button className="btn ghost" onClick={() => move(i, 1)} disabled={i === routine.steps.length - 1} aria-label={`Move ${st.title} down`}>↓</button>
                  <button className="btn ghost" onClick={() => s.setSteps(routine.id, routine.steps.filter((x) => x.id !== st.id))} aria-label={`Remove ${st.title}`}>✕</button>
                </span>
              ) : (
                <button className="btn ghost" onClick={() => s.toggleSkipStep(today, routine.id, st.id)}>
                  {isSkipped ? 'Bring back' : 'Skip today'}
                </button>
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
          <button className="btn danger small" onClick={() => setConfirmDel(true)}>Delete this routine</button>
        </>
      )}
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
  const { data, addRoutine } = useStore();
  const [kind, setKind] = useState<'morning' | 'evening'>(new Date().getHours() >= 15 ? 'evening' : 'morning');
  const list = data.routines.filter((r) => r.kind === kind);

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Daily Rituals · morning &amp; evening routines</p>
        <h1>{kind === 'morning' ? 'Morning flowerbed' : 'Evening flowerbed'}</h1>
        <p className="hint">Checklists reset each day. Skip anything you like; nothing is lost. Medication items are just your own reminders, not medical advice.</p>
        <div className="tabs" role="tablist" aria-label="Routine type">
          {(['morning', 'evening'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className={'tab' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>
              {k === 'morning' ? '🌅 Morning' : '🌙 Evening'}
            </button>
          ))}
        </div>
      </header>
      {list.map((r) => <RoutineCard key={r.id} routine={r} />)}
      {list.length === 0 && <p className="empty">No {kind} routine yet. Plant one whenever you like.</p>}
      <button className="btn primary" onClick={() => addRoutine(kind, kind === 'morning' ? 'New morning routine' : 'New evening routine')}>
        ＋ New {kind} routine
      </button>
    </div>
  );
}
