import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useSync } from '../sync';
import { Modal } from './Modal';
import { autoBackupOn, hasPin } from '../lib/device';
import { KIND_LABEL } from '../lib/trash';
import { describeCounts, mergeImport, totalAdded, totalSkipped } from '../lib/merge';
import { storageHealth, WARN_AT, type Health } from '../lib/storageHealth';
import type { AppData } from '../lib/types';

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

type State = 'ok' | 'off' | 'warn';
const ICON: Record<State, string> = { ok: '✓', off: '○', warn: '⚠' };

/** A short list of what is on and off, with a shortcut to each setting. */
export function SettingsCheck() {
  const s = useStore();
  const sync = useSync();
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    void storageHealth().then((h) => alive && setHealth(h));
    return () => {
      alive = false;
    };
  }, [s.data]);

  const offlineReady = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
  const mins = sync.lastSync ? Math.floor((Date.now() - new Date(sync.lastSync).getTime()) / 60000) : null;
  const rows: { name: string; state: State; text: string; to: string }[] = [
    {
      name: 'Sync',
      state: sync.config ? (sync.status === 'error' ? 'warn' : 'ok') : 'off',
      text: !sync.config ? 'Off. This device keeps its own copy.' : sync.status === 'error' ? 'On, but there is a problem. Open sync to see it.' : mins === null ? 'On.' : mins < 1 ? 'On. Synced just now.' : `On. Last synced ${mins} min ago.`,
      to: 'sy-h',
    },
    {
      name: 'Backup',
      state: s.data.settings.lastBackup ? 'ok' : 'warn',
      text: `${s.data.settings.lastBackup ? `Last backup ${s.data.settings.lastBackup}.` : 'No backup made yet.'} Weekly automatic backup is ${autoBackupOn() ? 'on' : 'off'}.`,
      to: 'bk-h',
    },
    { name: 'App lock', state: hasPin() ? 'ok' : 'off', text: hasPin() ? 'A PIN is set on this device.' : 'No PIN on this device.', to: 'dv-h' },
    {
      name: 'Works offline',
      state: offlineReady ? 'ok' : 'off',
      text: offlineReady ? 'Ready. The app is saved on this device.' : 'Not saved on this device yet. Open the installed app once with internet.',
      to: 'up-h',
    },
    { name: 'Reminders', state: s.data.settings.notifications ? 'ok' : 'off', text: s.data.settings.notifications ? 'On, while the app is open.' : 'Off.', to: 'nt-h' },
    {
      name: 'Storage',
      state: s.saveFailed || (health && health.ratio >= WARN_AT) ? 'warn' : 'ok',
      text: s.saveFailed ? "This browser couldn't save. Export a backup." : health ? `Saving works. Browser storage is ${health.text}.` : 'Saving works.',
      to: 'bk-h',
    },
  ];
  return (
    <section className="card" aria-labelledby="chk-h">
      <h2 id="chk-h">Settings check</h2>
      <ul className="check">
        {rows.map((r) => (
          <li key={r.name} className={r.state}>
            <span className="mark" aria-hidden="true">{ICON[r.state]}</span>
            <span>
              <strong>{r.name}</strong>
              <br />
              <small>{r.text}</small>
            </span>
            <button className="btn ghost small" onClick={() => jump(r.to)} aria-label={`Go to ${r.name} settings`}>Open</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Undo and Redo, and a list of the latest changes. */
export function HistoryPanel() {
  const { history, canUndo, canRedo, undo, redo } = useStore();
  return (
    <section className="card" aria-labelledby="hx-h">
      <h2 id="hx-h">Undo &amp; history</h2>
      <div className="actions left">
        <button className="btn" onClick={undo} disabled={!canUndo}>↶ Undo last change</button>
        <button className="btn" onClick={redo} disabled={!canRedo}>↷ Redo</button>
      </div>
      {history.length === 0 ? (
        <p className="hint">No changes to take back yet. Recent ones will be listed here.</p>
      ) : (
        <ol className="history" aria-label="Recent changes, newest first">
          {history.slice(0, 15).map((h, i) => (
            <li key={h.at + '-' + i}>
              {h.text} <small>{clock(h.at)}</small>
            </li>
          ))}
        </ol>
      )}
      <p className="hint">Undo covers tasks, routines, templates, counters and countdowns. It starts over after an import, a restore or a sync that brings in changes.</p>
    </section>
  );
}

/** Deleted things stay here for 30 days. */
export function DeletedPanel() {
  const { trash, restoreDeleted, discardDeleted, emptyTrash } = useStore();
  const [ask, setAsk] = useState<{ id: string; title: string } | 'all' | null>(null);
  return (
    <section className="card" aria-labelledby="tr-h">
      <h2 id="tr-h">Recently deleted</h2>
      {trash.length === 0 ? (
        <p className="hint">Nothing deleted lately. Things you delete wait here for 30 days before they are gone for good.</p>
      ) : (
        <>
          <ul className="sublist">
            {trash.map((e) => (
              <li key={e.id}>
                <span>
                  <small>{KIND_LABEL[e.kind]}</small> {e.title} <small>· deleted {day(e.at)}</small>
                </span>
                <span className="inline-actions">
                  <button className="btn small" onClick={() => restoreDeleted(e.id)} aria-label={`Bring back ${e.title}`}>Bring back</button>
                  <button className="btn ghost small" onClick={() => setAsk({ id: e.id, title: e.title })} aria-label={`Remove ${e.title} for good`}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="actions left">
            <button className="btn danger" onClick={() => setAsk('all')}>Empty Recently deleted</button>
          </div>
        </>
      )}
      <p className="hint">This list stays on this device and doesn't sync.</p>
      {ask && (
        <Modal title="Remove for good?" onClose={() => setAsk(null)}>
          <p>{ask === 'all' ? `All ${trash.length} items here will be gone for good.` : `“${ask.title}” will be gone for good.`}</p>
          <div className="actions">
            <button className="btn" onClick={() => setAsk(null)}>Keep it</button>
            <button
              className="btn danger"
              onClick={() => {
                if (ask === 'all') emptyTrash();
                else discardDeleted(ask.id);
                setAsk(null);
              }}
            >
              Remove for good
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export interface PendingImport {
  data: AppData;
  from?: string;
  fileName: string;
}

/** "Check first": shows what a backup file would add before anything is saved. */
export function ImportCheck({ pending, onClose, onDone }: { pending: PendingImport; onClose: () => void; onDone: (text: string) => void }) {
  const s = useStore();
  const [replace, setReplace] = useState(false);
  const { data, report } = mergeImport(s.data, pending.data);
  const add = totalAdded(report);
  const skip = totalSkipped(report);

  return (
    <Modal title="Check before importing" onClose={onClose}>
      <p className="hint">{pending.fileName}{pending.from ? ` · ${pending.from}` : ''}. Nothing has been saved yet.</p>
      {!replace ? (
        <>
          {add > 0 ? (
            <p>
              <strong>Would add:</strong> {describeCounts(report.added)}.
            </p>
          ) : (
            <p><strong>Nothing new to add.</strong> Everything in this file is already here.</p>
          )}
          {skip > 0 && (
            <p>
              <strong>Already here, so skipped:</strong> {describeCounts(report.skipped)}.
              {report.skippedNames.length > 0 && <small className="block">{report.skippedNames.join(', ')}{skip > report.skippedNames.length ? ', …' : ''}</small>}
            </p>
          )}
          <p className="hint">Importing never changes or deletes what you already have.</p>
          <div className="actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn ghost" onClick={() => setReplace(true)}>Replace everything instead…</button>
            {add > 0 && (
              <button
                className="btn primary"
                data-autofocus
                onClick={() => {
                  s.replaceAll(data);
                  onDone(`Added ${describeCounts(report.added)}.${skip ? ` Skipped ${skip} that were already here.` : ''}`);
                }}
              >
                Add what's new
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p>
            This swaps your whole garden for the file: {pending.data.tasks.length} activities and {pending.data.routines.length} routines. Anything that is only here, not in the file, will be gone
            {s.data.tasks.length + s.data.routines.length > 0 ? ` (you now have ${s.data.tasks.length} activities and ${s.data.routines.length} routines)` : ''}. Export a backup first if you aren't sure.
          </p>
          <div className="actions">
            <button className="btn" data-autofocus onClick={() => setReplace(false)}>Back</button>
            <button
              className="btn danger"
              onClick={() => {
                s.replaceAll(pending.data);
                onDone(`Replaced everything with the file: ${pending.data.tasks.length} activities and ${pending.data.routines.length} routines.`);
              }}
            >
              Yes, replace everything
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
