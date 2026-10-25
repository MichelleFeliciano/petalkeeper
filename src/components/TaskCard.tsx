import { useRef, useState } from 'react';
import { useStore } from '../store';
import { useUI } from '../ui';
import { describeRecurrence, isDone, subtaskDone, type Occurrence } from '../lib/schedule';
import { fmtDuration, fmtShort, fmtTime } from '../lib/dates';
import { categoryOf } from '../lib/types';

const CHEERS = ['A little progress is still progress.', 'Look at that, something new is blooming.', 'Lovely. Your garden thanks you.'];

export function TaskCard({
  occ,
  conflict,
  showDate,
  extra,
  onRename,
  onSwipe,
}: {
  occ: Occurrence;
  conflict?: boolean;
  showDate?: boolean;
  extra?: React.ReactNode;
  /** when given, tapping the title edits it in place and this is called with the new title */
  onRename?: (title: string) => void;
  /** when given, a swipe on a touch screen calls this: right = tick off, left = remove */
  onSwipe?: (dir: 'right' | 'left') => void;
}) {
  const { task, date } = occ;
  const { toggleDone, toggleSubtask, duplicateTask, notify, data } = useStore();
  const { openForm, openOccurrence, askDelete } = useUI();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const touch = useRef<{ x: number; y: number } | null>(null);
  const finishRename = () => {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== task.title) onRename?.(t);
  };
  const done = isDone(task, date);
  const cat = categoryOf(data.settings, task.category);
  const doneSubs = task.subtasks.filter((s) => subtaskDone(task, date, s.id)).length;

  return (
    <article
      className={'card task' + (done ? ' done' : '') + (conflict ? ' conflict' : '')}
      data-priority={task.priority}
      style={cat.color ? ({ '--cat': cat.color } as React.CSSProperties) : undefined}
      onTouchStart={onSwipe ? (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } : undefined}
      onTouchEnd={onSwipe ? (e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = Math.abs(e.changedTouches[0].clientY - t.y);
        if (dy < 40 && Math.abs(dx) >= 80) onSwipe(dx > 0 ? 'right' : 'left');
      } : undefined}
    >
      <input
        type="checkbox"
        className="check"
        checked={done}
        onChange={() => {
          toggleDone(task.id, date);
          if (!done && data.settings.showFairy && (data.blooms + 1) % 4 === 0) notify(CHEERS[(data.blooms / 4) % CHEERS.length | 0]);
        }}
        aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${task.title}`}
      />
      <div className="task-body">
        <div className="task-title">
          <span aria-hidden="true">{cat.icon} </span>
          {editing ? (
            <input
              className="t-edit"
              autoFocus
              value={draft}
              maxLength={200}
              aria-label={`Rename ${task.title}`}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishRename();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          ) : onRename ? (
            <button className="t t-btn" onClick={() => { setDraft(task.title); setEditing(true); }} aria-label={`Rename ${task.title}`}>{task.title}</button>
          ) : (
            <span className="t">{task.title}</span>
          )}
          {done && <span className="badge ok"> ✓ Done</span>}
        </div>
        <div className="meta">
          {showDate && <span>{fmtShort(date)}</span>}
          {task.start && (
            <span>
              {fmtTime(task.start)}
              {task.end ? ` – ${fmtTime(task.end)}` : ''}
            </span>
          )}
          {!task.end && task.duration ? <span>{fmtDuration(task.duration)}</span> : null}
          {task.priority !== 'normal' && <span className={'badge ' + task.priority}>{task.priority === 'high' ? 'High priority' : 'Low priority'}</span>}
          {task.recurrence && <span>↻ {describeRecurrence(task)}</span>}
          {task.due && <span>Due {fmtShort(task.due)}</span>}
          {task.subtasks.length > 0 && (
            <span>
              {doneSubs}/{task.subtasks.length} steps
            </span>
          )}
          {conflict && <span className="badge warn">Overlaps with another activity</span>}
        </div>
        {task.notes && <p className="notes">{task.notes}</p>}
        {open && task.subtasks.length > 0 && (
          <ul className="steps">
            {task.subtasks.map((s) => (
              <li key={s.id}>
                <label>
                  <input type="checkbox" checked={subtaskDone(task, date, s.id)} onChange={() => toggleSubtask(task.id, date, s.id)} /> {s.title}
                </label>
              </li>
            ))}
          </ul>
        )}
        {extra}
      </div>
      <div className="task-actions">
        {task.subtasks.length > 0 && (
          <button className="btn ghost" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} steps for ${task.title}`}>
            {open ? '▾' : '▸'} Steps
          </button>
        )}
        <button className="btn ghost" onClick={() => openForm(task)} aria-label={`Edit ${task.title}`}>
          {task.recurrence ? 'Edit series' : 'Edit'}
        </button>
        {task.recurrence && (
          <button className="btn ghost" onClick={() => openOccurrence(task, date)} aria-label={`Edit only this day of ${task.title}`}>
            Edit this day
          </button>
        )}
        <button className="btn ghost" onClick={() => duplicateTask(task.id)} aria-label={`Duplicate ${task.title}`}>
          Copy
        </button>
        <button className="btn ghost" onClick={() => askDelete(task, date)} aria-label={`Delete ${task.title}`}>
          Delete
        </button>
      </div>
    </article>
  );
}
