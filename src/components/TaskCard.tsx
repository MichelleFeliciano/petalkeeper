import { useState } from 'react';
import { useStore } from '../store';
import { useUI } from '../ui';
import { describeRecurrence, isDone, subtaskDone, type Occurrence } from '../lib/schedule';
import { fmtDuration, fmtShort, fmtTime } from '../lib/dates';
import { CATEGORIES } from '../lib/types';

export function TaskCard({
  occ,
  conflict,
  showDate,
  extra,
}: {
  occ: Occurrence;
  conflict?: boolean;
  showDate?: boolean;
  extra?: React.ReactNode;
}) {
  const { task, date } = occ;
  const { toggleDone, toggleSubtask, duplicateTask } = useStore();
  const { openForm, askDelete } = useUI();
  const [open, setOpen] = useState(false);
  const done = isDone(task, date);
  const cat = CATEGORIES.find((c) => c.id === task.category);
  const doneSubs = task.subtasks.filter((s) => subtaskDone(task, date, s.id)).length;

  return (
    <article className={'card task' + (done ? ' done' : '') + (conflict ? ' conflict' : '')} data-priority={task.priority}>
      <input
        type="checkbox"
        className="check"
        checked={done}
        onChange={() => toggleDone(task.id, date)}
        aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${task.title}`}
      />
      <div className="task-body">
        <div className="task-title">
          <span aria-hidden="true">{cat?.icon} </span>
          <span className="t">{task.title}</span>
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
          Edit
        </button>
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
