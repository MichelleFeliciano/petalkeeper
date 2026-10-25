import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useUI } from '../ui';
import { TaskCard } from '../components/TaskCard';
import { AdjustDay } from '../components/AdjustDay';
import { TimeBlocks } from '../components/TimeBlocks';
import { TemplatesModal } from '../components/TemplatesModal';
import { Fairy, GardenStrip, type Pose } from '../components/Fairy';
import { DoNow, TodaysRoutines, Counters, CheckIn } from '../components/DailyExtras';
import { findConflicts, isDone, itemsOn } from '../lib/schedule';
import { addDays, fmtDuration, fmtLong, fmtTime, fromISO, nowMinutes, toMinutes } from '../lib/dates';
import type { Priority } from '../lib/types';

const MESSAGES = {
  morning: ['Welcome back to your garden.', "Let's tend to one little thing."],
  afternoon: ['Your next step is ready.', 'A little progress is still progress.'],
  evening: ["It's okay to leave some things for tomorrow.", 'Time to rest your wings.'],
  allDone: ['Everything is tended. Enjoy the quiet.', 'What a lovely day in the garden.'],
  empty: ['An open day is a gift. Plant something only if you like.', 'A blank page is lovely too.'],
};

const prio: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

export function Today() {
  const { data, today, copyDay, moveOccurrence } = useStore();
  const { openForm } = useUI();
  const [adjust, setAdjust] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [view, setView] = useState<'list' | 'hours'>('list');
  const { updateSettings } = useStore();
  const { tasks, settings } = data;

  const items = useMemo(() => itemsOn(tasks, today), [tasks, today]);
  const timed = items.filter((o) => o.task.start);
  const flexible = items.filter((o) => !o.task.start).sort((a, b) => prio[a.task.priority] - prio[b.task.priority]);
  const conflicts = useMemo(() => findConflicts(items, settings.defaultDuration, settings.buffer), [items, settings]);

  const total = items.length;
  const done = items.filter((o) => isDone(o.task, o.date)).length;

  // tasks from earlier days that are still open
  const earlier = useMemo(() => {
    const out = [];
    for (const t of tasks) {
      if (t.recurrence || t.done || !t.date || t.date >= today) continue;
      out.push({ task: t, date: t.date, key: `${t.id}@${t.date}` });
    }
    return out;
  }, [tasks, today]);

  const pouch = tasks.filter((t) => !t.recurrence && !t.date && !t.done);

  const now = nowMinutes();
  const next =
    timed.find((o) => !isDone(o.task, o.date) && toMinutes(o.task.start!) >= now) ??
    items.find((o) => !isDone(o.task, o.date));

  const hour = new Date().getHours();
  const lastB = settings.lastBackup;
  const needsBackup =
    tasks.length + data.routines.length > 0 &&
    (!settings.backupSnooze || settings.backupSnooze <= today) &&
    (lastB ? lastB <= addDays(today, -21) : !!data.blooms);
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const bucket = total === 0 ? MESSAGES.empty : done === total ? MESSAGES.allDone : hour < 12 ? MESSAGES.morning : hour < 18 ? MESSAGES.afternoon : MESSAGES.evening;
  const msg = bucket[fromISO(today).getDate() % bucket.length];
  const pose: Pose = total > 0 && done === total ? 'encourage' : hour >= 20 ? 'rest' : 'welcome';

  const unfinished = [...earlier, ...items.filter((o) => !isDone(o.task, o.date))];
  const prevHas = tasks.some((t) => !t.recurrence && t.date === addDays(today, -1));

  return (
    <div className="page">
      <header className="hero card">
        <div>
          <p className="eyebrow">Today's Garden · your daily plan</p>
          <h1>{fmtLong(today)}</h1>
          <p className="greet">{greet}.{settings.showFairy ? ` ${msg}` : ''}</p>
          <div className="progress" aria-label={`${done} of ${total} done today`}>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
              <span style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
            </div>
            <span>{total === 0 ? 'A quiet day ahead' : `${done} of ${total} tended`}</span>
          </div>
          <div className="actions left">
            <button className="btn primary" onClick={() => openForm(undefined, { date: today })}>
              ＋ Quick add
            </button>
            <button className="btn" onClick={() => setAdjust(true)}>
              Adjust My Day
            </button>
            <button className="btn ghost" onClick={() => setTemplates(true)}>
              Templates
            </button>
            <button className="btn ghost" onClick={() => window.print()}>
              Print
            </button>
            {prevHas && (
              <button className="btn ghost" onClick={() => copyDay(addDays(today, -1), today)}>
                Copy yesterday's plan
              </button>
            )}
          </div>
        </div>
        {settings.showFairy && <Fairy pose={pose} />}
      </header>

      <DoNow />

      <TodaysRoutines />

      <Counters />

      <CheckIn />

      {needsBackup && (
        <div className="notice calm" role="note">
          <span>It's been a while since your last backup. Your schedule lives only in this browser.</span>
          <span className="actions left">
            <a className="btn small" href="#/shed">Back up now</a>
            <button className="btn ghost small" onClick={() => updateSettings({ backupSnooze: addDays(today, 14) })}>Remind me later</button>
          </span>
        </div>
      )}

      {next && (
        <section className="card next" aria-labelledby="next-h">
          <h2 id="next-h">Next up</h2>
          <p>
            <strong>{next.task.title}</strong>
            {next.task.start ? ` · ${fmtTime(next.task.start)}` : ' · whenever suits you'}
            {next.task.duration || next.task.end ? ` · ${fmtDuration(next.task.duration ?? toMinutes(next.task.end!) - toMinutes(next.task.start!))}` : ''}
          </p>
        </section>
      )}

      <section aria-labelledby="tl-h">
        <h2 id="tl-h">
          Timeline
          <span className="tabs inline" role="group" aria-label="Timeline style">
            <button className={'tab' + (view === 'list' ? ' on' : '')} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
            <button className={'tab' + (view === 'hours' ? ' on' : '')} aria-pressed={view === 'hours'} onClick={() => setView('hours')}>Hours</button>
          </span>
        </h2>
        {view === 'hours' ? (
          <TimeBlocks items={timed} conflicts={conflicts} />
        ) : timed.length === 0 ? (
          <p className="empty">Nothing is set for a specific time. Lovely, open space.</p>
        ) : (
          timed.map((o) => <TaskCard key={o.key} occ={o} conflict={conflicts.has(o.key)} />)
        )}
      </section>

      <section aria-labelledby="fl-h">
        <h2 id="fl-h">Flexible tasks <small>do these whenever suits you</small></h2>
        {flexible.length === 0 ? <p className="empty">No flexible tasks today.</p> : flexible.map((o) => <TaskCard key={o.key} occ={o} />)}
      </section>

      {earlier.length > 0 && (
        <section aria-labelledby="ea-h">
          <h2 id="ea-h">Waiting from earlier <small>no pressure</small></h2>
          {earlier.map((o) => (
            <TaskCard
              key={o.key}
              occ={o}
              showDate
              extra={
                <button className="btn small" onClick={() => moveOccurrence(o.task.id, o.date, { date: today })}>
                  Bring to today
                </button>
              }
            />
          ))}
        </section>
      )}

      {pouch.length > 0 && (
        <section aria-labelledby="po-h">
          <h2 id="po-h">From your Seed Pouch <small>unscheduled</small></h2>
          {pouch.slice(0, 4).map((t) => (
            <TaskCard
              key={t.id}
              occ={{ task: t, date: today, key: t.id }}
              extra={
                <button className="btn small" onClick={() => moveOccurrence(t.id, today, { date: today })}>
                  Plant it today
                </button>
              }
            />
          ))}
        </section>
      )}

      {settings.showGarden && <GardenStrip blooms={data.blooms} decor={settings.decor} />}
      {templates && <TemplatesModal date={today} items={items} onClose={() => setTemplates(false)} />}
      {adjust && <AdjustDay items={unfinished} onClose={() => setAdjust(false)} />}
    </div>
  );
}
