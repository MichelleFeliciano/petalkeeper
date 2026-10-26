import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Modal } from '../components/Modal';
import { exportJSON, parseImport } from '../lib/storage';
import { todayISO } from '../lib/dates';
import { buildICS, downloadText } from '../lib/ics';
import { newId } from '../lib/schedule';
import { SyncPanel } from '../components/SyncPanel';
import { DevicePanel } from '../components/DevicePanel';
import { PlacesPanel } from '../components/PlacesPanel';
import { SecondMemoryTodos } from '../components/SecondMemoryTodos';
import { buildRoutineICS } from '../lib/routines';
import { useSync } from '../sync';
import { applyUpdate, CACHE_NAME, fetchLatest, isNewer, versionLabel } from '../lib/update';
import { WhatsNewList } from '../components/Banners';
import { DeletedPanel, HistoryPanel, ImportCheck, SettingsCheck, type PendingImport } from '../components/DataSafety';

const label = versionLabel;

/** Looks for a newer published version; only reloads when there really is one. */
async function updateApp(setNote: (t: string) => void) {
  const mine = label(__APP_VERSION__, __APP_BUILD__);
  setNote('Checking for a new version…');
  const latest = await fetchLatest();
  if (!latest) {
    setNote(`Couldn't check right now. You may be offline. You're on ${mine}.`);
    return;
  }
  if (!isNewer(latest)) {
    setNote(`You're on the newest version, ${mine}. Nothing to update.`);
    return;
  }
  setNote(`Updating from ${mine} to ${label(latest.version, latest.build)}…`);
  await applyUpdate();
}

/** A number box that lets you clear it and type a new value; it only commits a valid number. */
function NumField({ value, min, step, onCommit }: { value: number; min: number; step: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n) && n >= min) onCommit(n);
      }}
      onBlur={() => {
        const n = Number(text);
        if (text === '' || !Number.isFinite(n) || n < min) setText(String(value));
      }}
    />
  );
}

const JUMPS: [string, string][] = [
  ['chk-h', 'Check'],
  ['pref-h', 'Preferences'],
  ['nt-h', 'Reminders'],
  ['smt-h', 'Import to-dos'],
  ['cc-h', 'Categories'],
  ['pl-h', 'Places'],
  ['sy-h', 'Sync'],
  ['dv-h', 'This device'],
  ['bk-h', 'Backup'],
  ['hx-h', 'History'],
  ['tr-h', 'Deleted'],
  ['up-h', 'Updates'],
  ['rs-h', 'Start fresh'],
];

/** A row of shortcuts so a long settings page is quick to get around on a phone. */
function JumpBar() {
  return (
    <nav className="jump" aria-label="Jump to a section">
      {JUMPS.map(([id, label]) => (
        <button key={id} className="tab" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {label}
        </button>
      ))}
    </nav>
  );
}

export function Shed() {
  const s = useStore();
  const { settings } = s.data;
  const fileRef = useRef<HTMLInputElement>(null);
  const syncing = !!useSync().config;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<'sample' | 'all' | null>(null);
  const [cat, setCat] = useState({ label: '', icon: '🌸', color: '#E8B8C4' });
  const [permMsg, setPermMsg] = useState('');
  const [updNote, setUpdNote] = useState('');
  const [pending, setPending] = useState<PendingImport | null>(null);

  const toggleNotifications = async (on: boolean) => {
    setPermMsg('');
    if (!on) return s.updateSettings({ notifications: false });
    if (typeof Notification === 'undefined') return setPermMsg('This browser does not support notifications.');
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (p === 'granted') s.updateSettings({ notifications: true });
    else setPermMsg('Notifications were not allowed, so reminders stay off. You can allow them in your browser settings.');
  };

  const exportNow = () => {
    const blob = new Blob([exportJSON(s.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `petalkeeper-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    s.updateSettings({ lastBackup: todayISO() });
    setMsg({ ok: true, text: 'Backup saved to your downloads folder.' });
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    let meta: { app?: unknown; appVersion?: unknown; exportedAt?: unknown } = {};
    try {
      meta = JSON.parse(text) ?? {};
    } catch {
      /* parseImport explains it */
    }
    if (typeof meta.app === 'string' && meta.app !== 'petalkeeper') return setMsg({ ok: false, text: `That file is from ${meta.app}, not Petalkeeper. Your current data was not changed.` });
    const res = parseImport(text);
    if (!res.ok) return setMsg({ ok: false, text: `${res.error} Your current data was not changed.` });
    const from = [
      typeof meta.appVersion === 'string' ? `made by Petalkeeper v${meta.appVersion}` : '',
      typeof meta.exportedAt === 'string' && !Number.isNaN(Date.parse(meta.exportedAt)) ? `saved ${new Date(meta.exportedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : '',
    ].filter(Boolean).join(', ');
    setMsg(null);
    setPending({ data: res.data, from, fileName: file.name });
  };

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Garden Shed · settings &amp; backups</p>
        <h1>Garden Shed</h1>
      </header>

      <JumpBar />

      <SettingsCheck />

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
            <NumField value={settings.defaultDuration} min={5} step={5} onCommit={(n) => s.updateSettings({ defaultDuration: n })} />
          </label>
          <label>
            Breathing room between activities (minutes)
            <NumField value={settings.buffer} min={0} step={5} onCommit={(n) => s.updateSettings({ buffer: n })} />
          </label>
        </div>
        <div className="row">
          <label>
            Theme
            <select value={settings.theme} onChange={(e) => s.updateSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}>
              <option value="system">Match my phone or computer</option>
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
        <label>
          Garden decorations
          <select value={settings.decor} onChange={(e) => s.updateSettings({ decor: e.target.value as typeof settings.decor })}>
            <option value="blooms">Flowers</option>
            <option value="mushrooms">Mushrooms</option>
            <option value="butterflies">Butterflies</option>
            <option value="stars">Stars</option>
          </select>
        </label>
      </section>

      <section className="card form" aria-labelledby="nt-h">
        <h2 id="nt-h">Reminders</h2>
        <label className="inline">
          <input type="checkbox" checked={settings.notifications} onChange={(e) => void toggleNotifications(e.target.checked)} /> Gentle reminders for timed activities
        </label>
        {settings.notifications && (
          <label>
            Remind me this many minutes before
            <NumField value={settings.notifyLead} min={0} step={5} onCommit={(n) => s.updateSettings({ notifyLead: n })} />
          </label>
        )}
        {settings.notifications && (
          <label>
            Daily nudge about to-dos that are due today or late (empty = off)
            <input type="time" value={settings.todoRemindAt ?? ''} onChange={(e) => s.updateSettings({ todoRemindAt: e.target.value || undefined })} />
          </label>
        )}
        {permMsg && <p className="error" role="alert">{permMsg}</p>}
        <p className="hint">Reminders only appear while Petalkeeper is open in a browser tab. If it's closed, nothing can be delivered. Everything works fine with reminders off.</p>
      </section>

      <SecondMemoryTodos />

      <section className="card form" aria-labelledby="cc-h">
        <h2 id="cc-h">Your own categories</h2>
        {settings.customCategories.length > 0 && (
          <ul className="sublist">
            {settings.customCategories.map((c) => (
              <li key={c.id}>
                <span><span style={{ color: c.color }} aria-hidden="true">●</span> {c.icon} {c.label}</span>
                <button className="btn ghost" aria-label={`Remove category ${c.label}`} onClick={() => s.updateSettings({ customCategories: settings.customCategories.filter((x) => x.id !== c.id) })}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cat.label.trim()) return;
            s.updateSettings({ customCategories: [...settings.customCategories, { id: 'c-' + newId(), label: cat.label.trim(), icon: cat.icon || '🌸', color: cat.color }] });
            setCat({ ...cat, label: '' });
          }}
        >
          <label>Name<input value={cat.label} onChange={(e) => setCat({ ...cat, label: e.target.value })} placeholder="e.g. Pets" /></label>
          <label>Emoji<input value={cat.icon} maxLength={4} onChange={(e) => setCat({ ...cat, icon: e.target.value })} /></label>
          <label>Color<input type="color" value={cat.color} onChange={(e) => setCat({ ...cat, color: e.target.value })} /></label>
          <button className="btn" type="submit">Add category</button>
        </form>
        <p className="hint">Tasks in a removed category keep working and show as "Other".</p>
      </section>

      <PlacesPanel />

      <SyncPanel />

      <DevicePanel />

      <section className="card" aria-labelledby="bk-h">
        <h2 id="bk-h">Backup &amp; restore</h2>
        <p>
          Your data lives in this browser on this device. Sync (above) can keep your other devices in step, but it can still be lost if you clear browser data, so export a backup now and then.
        </p>
        <div className="actions left">
          <button className="btn primary" onClick={exportNow}>Export backup (JSON)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import backup (check first)…</button>
          <button className="btn" onClick={() => downloadText('petalkeeper-calendar.ics', buildICS(s.data.tasks, todayISO(), 90, settings.defaultDuration), 'text/calendar')}>Export next 90 days (.ics)</button>
          <button
            className="btn"
            onClick={() => {
              const { text, count } = buildRoutineICS(s.data.routines, todayISO());
              if (count === 0) return setMsg({ ok: false, text: 'No routine has a calendar nudge time yet. Edit a routine and set one.' });
              downloadText('petalkeeper-routine-nudges.ics', text, 'text/calendar');
              setMsg({ ok: true, text: `Saved ${count} repeating reminder${count === 1 ? '' : 's'}. Open the file to add them to your phone's calendar.` });
            }}
          >
            Export routine nudges (.ics)
          </button>
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
        <p className="hint">{settings.lastBackup ? `Last backup: ${settings.lastBackup}.` : 'No backup made yet.'}</p>
        {msg && <p role="status" className={msg.ok ? 'ok-msg' : 'error'}>{msg.text}</p>}
        {s.saveFailed && <p className="error" role="alert">This browser couldn't save your data (private mode or full storage). Please export a backup.</p>}
      </section>

      <HistoryPanel />

      <DeletedPanel />

      <section className="card" aria-labelledby="up-h">
        <h2 id="up-h">App updates</h2>
        <p>
          You're on <strong>{label(__APP_VERSION__, __APP_BUILD__)}</strong>. Updating pulls the newest version and keeps your activities and settings exactly as they are.
        </p>
        <div className="actions left">
          <button className="btn primary" onClick={() => void updateApp(setUpdNote)}>Update app</button>
        </div>
        {updNote && <p role="status" aria-live="polite" className="ok-msg">{updNote}</p>}
        <p className="hint">Last updated {new Date(__APP_BUILD__).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. Offline copy: {CACHE_NAME}. A banner also appears by itself when a newer version is ready.</p>
        <WhatsNewList />
      </section>

      <section className="card" aria-labelledby="rs-h">
        <h2 id="rs-h">Start fresh</h2>
        <div className="actions left">
          <button className="btn" onClick={() => setConfirm('sample')}>Reset to sample data</button>
          <button className="btn danger" onClick={() => setConfirm('all')}>Erase all my data</button>
        </div>
      </section>

      {pending && (
        <ImportCheck
          pending={pending}
          onClose={() => setPending(null)}
          onDone={(text) => {
            setPending(null);
            setMsg({ ok: true, text });
          }}
        />
      )}

      {confirm && (
        <Modal title={confirm === 'all' ? 'Erase everything?' : 'Reset to sample data?'} onClose={() => setConfirm(null)}>
          <p>
            {confirm === 'all'
              ? `All activities, routines and history will be removed from this browser.${syncing ? ' Sync is on, so your other devices will be cleared too.' : ''} Consider exporting a backup first.`
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
