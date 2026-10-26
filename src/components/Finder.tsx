import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Modal } from './Modal';
import { searchAll, type HitPage } from '../lib/search';

/** One search box for everything in the app. */
export function SearchModal({ onClose, onGo }: { onClose: () => void; onGo: (page: HitPage) => void }) {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const hits = useMemo(() => searchAll(data, q), [data, q]);
  return (
    <Modal title="Search" onClose={onClose}>
      <label>
        Search everything
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tasks, routines, steps, journal notes…" data-autofocus />
      </label>
      <div role="status" aria-live="polite">
        {q.trim() && hits.length === 0 && <p className="empty">Nothing matches yet.</p>}
        {!q.trim() && <p className="hint">Type a word or two. Everything stays on this device.</p>}
      </div>
      {hits.length > 0 && (
        <ul className="results">
          {hits.map((h) => (
            <li key={h.key}>
              <button
                className="result"
                onClick={() => {
                  onGo(h.page);
                  onClose();
                }}
              >
                <small>{h.kind}</small>
                <span>{h.title}</span>
                {h.detail && <small className="detail">{h.detail}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const TOPICS: [string, string][] = [
  ['Getting around', 'Today\'s Garden is your day. Daily Rituals holds routines for each part of the day, The Garden Path is the week and month, the Seed Pouch holds tasks and to-dos, the Garden Journal is for moods and notes, and the Garden Shed is settings and backups. The magnifier (or Ctrl+K) searches everything.'],
  ['Routines and the "do this now" card', 'A routine belongs to a part of the day, like Morning or Bedtime, and has no clock time. Tick steps off as you go. Today shows the next step to do. Pause routines, or switch on a gentle day to see only the essentials.'],
  ['Places and modes', 'Switch the place (Home, Mom\'s, Vacation, Road trip) and routines and steps tied to other places step aside. You can plan a stay ahead of time and it switches by itself.'],
  ['Mistakes and Undo', 'After you delete something, an Undo button appears for a few seconds. The Garden Shed has a History list with Undo and Redo, and a Recently deleted list that keeps deleted things on this device for 30 days so you can bring them back.'],
  ['Backups and moving to a new phone', 'Export backup saves one file. Import backup checks the file first and shows how many things are new, then adds only those. Nothing is overwritten and anything already here is skipped. Use Sync to keep two devices in step.'],
  ['Sync between devices', 'Sync uses your own private GitHub repository and a token that you create and paste in yourself. It is never stored in the app\'s code. The Sync section shows when it last synced and any problem.'],
  ['Privacy and the PIN', 'Everything is stored in this browser. Nothing is sent anywhere unless you turn on sync. The optional PIN is a casual lock for when someone else picks up your phone. It isn\'t encryption, so use your device\'s own lock too.'],
  ['Updating the app', 'A banner appears when a new version is ready. Update now keeps your data. After updating, What\'s new lists what changed. Settings has the version, its date and the full list.'],
  ['Working offline', 'Once opened with internet, the app is saved on this device and works without a connection. Syncing waits until you are back online.'],
  ['Text size and dark mode', 'Settings has a text size for this device and a theme that follows your device or can be set by hand.'],
];

export function HelpModal({ onClose, onWelcome }: { onClose: () => void; onWelcome: () => void }) {
  return (
    <Modal title="Help" onClose={onClose} wide>
      {TOPICS.map(([title, body]) => (
        <details key={title} className="help-topic">
          <summary>{title}</summary>
          <p>{body}</p>
        </details>
      ))}
      <div className="actions">
        <button
          className="btn"
          onClick={() => {
            onClose();
            onWelcome();
          }}
        >
          Show the welcome again
        </button>
        <button className="btn primary" data-autofocus onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
