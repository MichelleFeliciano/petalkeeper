import { useState } from 'react';
import { Modal } from './Modal';
import { useStore } from '../store';
import type { Occurrence } from '../lib/schedule';

/** Save today's plan as a reusable day, or lay a saved day onto today. */
export function TemplatesModal({ date, items, onClose }: { date: string; items: Occurrence[]; onClose: () => void }) {
  const { data, saveTemplate, applyTemplate, deleteTemplate } = useStore();
  const [name, setName] = useState('');
  const oneOffs = items.filter((o) => !o.task.recurrence);

  return (
    <Modal title="Day templates" onClose={onClose}>
      <p className="hint">Save a day you like, such as "Workday" or "Slow Sunday", and add it to any day with one click.</p>
      {data.templates.length === 0 ? (
        <p className="empty">No templates yet.</p>
      ) : (
        <ul className="adjust-list">
          {data.templates.map((t) => (
            <li key={t.id} className="card row">
              <span>
                <strong>{t.name}</strong>
                <span className="meta"> · {t.items.length} item{t.items.length === 1 ? '' : 's'}</span>
              </span>
              <span className="actions">
                <button className="btn small" onClick={() => { applyTemplate(t.id, date); onClose(); }} aria-label={`Add ${t.name} to this day`}>
                  Add to this day
                </button>
                <button className="btn ghost small" onClick={() => deleteTemplate(t.id)} aria-label={`Delete template ${t.name}`}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || oneOffs.length === 0) return;
          saveTemplate(name.trim(), oneOffs.map((o) => o.task));
          setName('');
        }}
      >
        <label>
          Save this day as…
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
        </label>
        <button className="btn primary" type="submit" disabled={!name.trim() || oneOffs.length === 0}>
          Save template
        </button>
      </form>
      {oneOffs.length === 0 && <p className="hint">Add a few activities to this day first. Repeating tasks aren't included.</p>}
    </Modal>
  );
}
