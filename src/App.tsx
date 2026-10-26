import { useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { itemsOn, isDone } from './lib/schedule';
import { reminderCount, reminderText } from './lib/todo';
import { fmtTime, nowMinutes, toMinutes } from './lib/dates';
import { UIProvider } from './ui';
import { SyncProvider, useSync } from './sync';
import { daysLeft } from './lib/sync';
import { LockGate, Tour } from './components/Gate';
import { applyTextSize, autoBackupDue, getTextSize, markAutoBackup } from './lib/device';
import { exportJSON } from './lib/storage';
import { downloadText } from './lib/ics';
import { makeTask } from './lib/schedule';
import { Today } from './pages/Today';
import { Rituals } from './pages/Rituals';
import { Path } from './pages/Path';
import { Seeds } from './pages/Seeds';
import { Shed } from './pages/Shed';
import { Journal } from './pages/Journal';
import { StorageBanner, UpdateBanner, WhatsNewBanner } from './components/Banners';
import { HelpModal, SearchModal } from './components/Finder';
import { versionLabel } from './lib/update';

const PAGES = [
  { id: 'today', label: "Today's Garden", short: 'Today', sub: 'Your day', icon: '🌼' },
  { id: 'rituals', label: 'Daily Rituals', short: 'Routines', sub: 'Routines', icon: '🌿' },
  { id: 'path', label: 'The Garden Path', short: 'Week', sub: 'Week', icon: '🗓️' },
  { id: 'seeds', label: 'Seed Pouch', short: 'Tasks', sub: 'Tasks', icon: '🌱' },
  { id: 'journal', label: 'Garden Journal', short: 'Journal', sub: 'Moods & notes', icon: '📖' },
  { id: 'shed', label: 'Garden Shed', short: 'Settings', sub: 'Settings', icon: '🧺' },
] as const;
type PageId = (typeof PAGES)[number]['id'];

const fromHash = (): PageId | null => {
  const h = window.location.hash.replace('#/', '').replace('#', '');
  return PAGES.find((p) => p.id === h)?.id ?? null;
};

const TODO_NUDGE_KEY = 'petalkeeper.todoNudgedOn';
const now0 = () => nowMinutes();

/** Gentle reminders. Only fire while the app is open; nothing runs in the background. */
function useReminders() {
  const { data, today } = useStore();
  const fired = useRef(new Set<string>());
  useEffect(() => {
    if (!data.settings.notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const tick = () => {
      const now = nowMinutes();
      for (const o of itemsOn(data.tasks, today)) {
        if (!o.task.start || isDone(o.task, o.date) || fired.current.has(o.key)) continue;
        const until = toMinutes(o.task.start) - now;
        if (until <= data.settings.notifyLead && until >= 0) {
          fired.current.add(o.key);
          new Notification('Petalkeeper', { body: `${o.task.title} at ${fmtTime(o.task.start)}`, icon: './icon.svg' });
        }
      }
    };
    // One gentle nudge a day, at the chosen time, about to-dos that are due today or late (once per day on this device).
    const nudge = () => {
      const at = data.settings.todoRemindAt;
      if (!at || now0() < toMinutes(at)) return;
      let last: string | null = null;
      try { last = localStorage.getItem(TODO_NUDGE_KEY); } catch { /* not remembered: may nudge again after a reload */ }
      if (last === today) return;
      const n = reminderCount(data.tasks, today);
      if (n === 0) return; // nothing to say yet; look again at the next check
      try { localStorage.setItem(TODO_NUDGE_KEY, today); } catch { /* ignore */ }
      new Notification('Petalkeeper', { body: reminderText(n), icon: './icon.svg' });
    };
    const both = () => { tick(); nudge(); };
    both();
    const t = setInterval(both, 30_000);
    return () => clearInterval(t);
  }, [data.tasks, data.settings.notifications, data.settings.notifyLead, data.settings.todoRemindAt, today]);
}

function ToastBar() {
  const { toast, undo, dismissToast } = useStore();
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.text}</span>
      {toast.undoable && <button className="btn small" onClick={undo}>Undo</button>}
      <button className="btn ghost small" onClick={dismissToast} aria-label="Dismiss">✕</button>
    </div>
  );
}

/** A small "is my other device up to date?" line under the menu. Tap it to open the sync settings. */
function SyncChip({ onOpen, variant }: { onOpen: () => void; variant: 'side' | 'top' }) {
  const sync = useSync();
  const { today } = useStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!sync.config) return null;
  const left = daysLeft(sync.config.tokenExpires, today);
  const expiring = left !== null && left <= 14;
  const mins = sync.lastSync ? Math.floor((Date.now() - new Date(sync.lastSync).getTime()) / 60000) : null;
  const text =
    sync.status === 'syncing' ? 'Syncing…' : sync.status === 'error' ? 'Sync problem. Tap to see' : expiring ? (left! <= 0 ? 'Token expired. Tap to renew' : `Token expires in ${left} day${left === 1 ? '' : 's'}`) : mins === null ? 'Sync is on' : mins < 1 ? 'Synced just now' : `Synced ${mins} min ago`;
  return (
    <button className={'sync-chip ' + variant + (sync.status === 'error' || expiring ? ' bad' : '')} onClick={onOpen} aria-label={`Sync status: ${text}. Open sync settings`}>
      <span aria-hidden="true">{sync.status === 'error' || expiring ? '⚠️' : '☁️'}</span> {text}
    </button>
  );
}

/** Text shared to Petalkeeper from another app lands in the Seed Pouch (Android, when installed). */
function useShareTarget(go: (id: PageId) => void) {
  const { addTask, notify } = useStore();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const title = (q.get('title') ?? '').trim();
    const text = (q.get('text') ?? '').trim();
    const link = (q.get('url') ?? '').trim();
    if (!title && !text && !link) return;
    const name = (title || text || link).split('\n')[0].slice(0, 120);
    const notes = [text && text !== name ? text : '', link && link !== name ? link : ''].filter(Boolean).join('\n');
    addTask(makeTask({ title: name, notes }));
    notify('Added to your Seed Pouch.');
    window.history.replaceState(null, '', window.location.pathname + '#/seeds');
    go('seeds');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/** A quiet note when there's no connection. Nothing breaks; it just explains why syncing waits. */
function OfflineNote() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <p className="offline" role="status">
      📴 You're offline. Everything still works here, and syncing will pick up again when you're back.
    </p>
  );
}

/** If you've turned it on, saves a backup file to your downloads about once a week (desktop browsers). */
function useWeeklyBackup() {
  const { data, today, updateSettings } = useStore();
  useEffect(() => {
    if (!autoBackupDue(today)) return;
    try {
      downloadText(`petalkeeper-backup-${today}.json`, exportJSON(data), 'application/json');
      markAutoBackup(today);
      updateSettings({ lastBackup: today });
    } catch {
      /* downloads blocked: the manual backup nudge still works */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function Shell() {
  const { data } = useStore();
  useReminders();
  useWeeklyBackup();
  useEffect(() => applyTextSize(getTextSize()), []);
  const [page, setPage] = useState<PageId>(() => fromHash() ?? data.settings.defaultPage);

  useEffect(() => {
    const on = () => setPage(fromHash() ?? data.settings.defaultPage);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [data.settings.defaultPage]);

  const go = (id: PageId) => {
    window.location.hash = '#/' + id;
    setPage(id);
    window.scrollTo?.(0, 0);
  };
  useShareTarget(go);
  const [finder, setFinder] = useState<'search' | 'help' | null>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setFinder('search');
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const openBackup = () => {
    go('shed');
    setTimeout(() => document.getElementById('bk-h')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <div className="app">
      <a href="#main" className="skip">Skip to content</a>
      <aside className="side">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
            <g fill="#E8B8C4">
              <circle cx="16" cy="8" r="5" /><circle cx="24" cy="16" r="5" /><circle cx="16" cy="24" r="5" /><circle cx="8" cy="16" r="5" />
            </g>
            <circle cx="16" cy="16" r="4" fill="#C9B8D9" />
          </svg>
          <div>
            <b>Petalkeeper</b>
            <small>Tend to what matters.</small>
          </div>
        </div>
        <nav aria-label="Main">
          {PAGES.map((p) => (
            <button key={p.id} className={'nav-item' + (page === p.id ? ' on' : '')} aria-current={page === p.id ? 'page' : undefined} aria-label={p.label} onClick={() => go(p.id)}>
              <span aria-hidden="true" className="ic">{p.icon}</span>
              <span className="lbl" aria-hidden="true">
                <span className="full">{p.label}</span>
                <span className="short">{p.short}</span>
                <small>{p.sub}</small>
              </span>
            </button>
          ))}
        </nav>
        <SyncChip variant="side" onOpen={() => go('shed')} />
        <p className="side-version">{versionLabel(__APP_VERSION__, __APP_BUILD__)}</p>
      </aside>
      <main id="main" tabIndex={-1}>
        <div className="topbar">
          <SyncChip variant="top" onOpen={() => go('shed')} />
          <span className="topbar-actions">
            <button className="btn ghost small" onClick={() => setFinder('search')} aria-label="Search" title="Search (Ctrl+K)">🔍 <span className="lbl-s">Search</span></button>
            <button className="btn ghost small" onClick={() => setFinder('help')} aria-label="Help">❓ <span className="lbl-s">Help</span></button>
          </span>
        </div>
        <UpdateBanner />
        <WhatsNewBanner />
        <StorageBanner onOpen={openBackup} />
        <OfflineNote />
        {page === 'today' && <Today />}
        {page === 'rituals' && <Rituals />}
        {page === 'path' && <Path />}
        {page === 'seeds' && <Seeds />}
        {page === 'journal' && <Journal />}
        {page === 'shed' && <Shed />}
      </main>
      <ToastBar />
      <Tour />
      {finder === 'search' && <SearchModal onClose={() => setFinder(null)} onGo={go} />}
      {finder === 'help' && <HelpModal onClose={() => setFinder(null)} onWelcome={() => window.dispatchEvent(new Event('petalkeeper:tour'))} />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <SyncProvider>
        <UIProvider>
          <LockGate>
            <Shell />
          </LockGate>
        </UIProvider>
      </SyncProvider>
    </StoreProvider>
  );
}
