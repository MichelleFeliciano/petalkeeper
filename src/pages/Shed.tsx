import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Modal } from '../components/Modal';
import { exportJSON, parseImport } from '../lib/storage';
import { todayISO } from '../lib/dates';

export function Shed() {
  const s = useStore();
  const { settings } = s.data;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<'sample' | 'all' | null>(null);

  const exportNow = () => {
    const blob = new Blob([exportJSON(s.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `petalkeeper-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ ok: true, text: 'Backup saved to your downloads folder.' });
  };

  const importFile = async (file: File) => {
    const res = parseImport(await file.text());
    if (!res.ok) return setMsg({ ok: false, text: `${res.error} Your current data was not changed.` });
    s.replaceAll(res.data);
    setMsg({ ok: true, text: `Restored ${res.data.tasks.length} activities and ${res.data.routines.length} routines.` });
  };

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Garden Shed · settings &amp; backups</p>
        <h1>Garden Shed</h1>
      </header>

      <section className="card form" aria-labelledby="pref-h">
        <h2 id="pref-h">Preferences</h2>
        <div className="row">
          <label>
            First day of the week
            <select value={settings.weekStart} onChange={(e) => s.updateSettings({ weekStart: Number(e.target.value) as 0 | 1 })}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
          </label>
          <label>
            Default task length (minutes)
            <input type="number" min="5" step="5" value={settings.defaultDuration} onChange={(e) => s.updateSettings({ defaultDuration: Math.max(5, Number(e.target.value) || 30) })} />
          </label>
          <label>
            Breathing room between activities (minutes)
            <input type="number" min="0" step="5" value={settings.buffer} onChange={(e) => s.updateSettings({ buffer: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
        </div>
        <div className="row">
          <label>
            Theme
            <select value={settings.theme} onChange={(e) => s.updateSettings({ theme: e.target.value as 'light' | 'dark' })}>
              <option value="light">Sunlit cream</option>
              <option value="dark">Twilight garden</option>
            </select>
          </label>
          <label>
            Open the app on
            <select value={settings.defaultPage} onChange={(e) => s.updateSettings({ defaultPage: e.target.value as typeof settings.defaultPage })}>
              <option value="today">Today's Garden</option>
              <option value="rituals">Daily Rituals</option>
              <option value="path">The Garden Path</option>
              <option value="seeds">Seed Pouch</option>
            </select>
          </label>
        </div>
        <label className="inline"><input type="checkbox" checked={settings.showFairy} onChange={(e) => s.updateSettings({ showFairy: e.target.checked })} /> Show the garden fairy and her messages</label>
        <label className="inline"><input type="checkbox" checked={settings.showGarden} onChange={(e) => s.updateSettings({ showGarden: e.target.checked })} /> Show the little blooming garden</label>
        <p className="hint">Reminders/notifications are not included in this version. The app keeps working fully without them.</p>
      </section>

      <section className="card" aria-labelledby="bk-h">
        <h2 id="bk-h">Backup &amp; restore</h2>
        <p>
          Everything is stored only in this browser on this device. It does not sync to other devices and can be lost if you clear browser data, so export a backup now and then.
        </p>
        <div className="actions left">
          <button className="btn primary" onClick={exportNow}>Export backup (JSON)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import backup…</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Import backup file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {msg && <p role="status" className={msg.ok ? 'ok-msg' : 'error'}>{msg.text}</p>}
        {s.saveFailed && <p className="error" role="alert">This browser couldn't save your data (private mode or full storage). Please export a backup.</p>}
      </section>

      <section className="card" aria-labelledby="rs-h">
        <h2 id="rs-h">Start fresh</h2>
        <div className="actions left">
          <button className="btn" onClick={() => setConfirm('sample')}>Reset to sample data</button>
          <button className="btn danger" onClick={() => setConfirm('all')}>Erase all my data</button>
        </div>
      </section>

      {confirm && (
        <Modal title={confirm === 'all' ? 'Erase everything?' : 'Reset to sample data?'} onClose={() => setConfirm(null)}>
          <p>
            {confirm === 'all'
              ? 'All activities, routines and history will be removed from this browser. Consider exporting a backup first.'
              : 'Your current activities and routines will be replaced with the editable examples.'}
          </p>
          <div className="actions">
            <button className="btn" onClick={() => setConfirm(null)}>Keep my data</button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirm === 'all') s.resetEverything();
                else s.resetSample();
                setConfirm(null);
              }}
            >
              {confirm === 'all' ? 'Erase' : 'Reset'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
