import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Modal } from './Modal';
import { CHANGELOG, releasesSince, type Release } from '../lib/changelog';
import { applyUpdate, fetchLatest, isNewer, markSeenVersion, prettyDate, seenVersion, versionLabel, type Published } from '../lib/update';
import { storageHealth, WARN_AT, type Health } from '../lib/storageHealth';

/** Looks for a newer published version by itself and offers to install it. Checks a few seconds after opening, every 15 minutes, and when you come back to the app. */
export function UpdateBanner() {
  const [latest, setLatest] = useState<Published | null>(null);
  const [later, setLater] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (navigator.onLine === false) return;
      const p = await fetchLatest();
      if (alive && isNewer(p)) setLatest(p);
    };
    const first = setTimeout(check, 4000);
    const every = setInterval(check, 15 * 60_000);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!latest || later === latest.build) return null;
  return (
    <div className="banner" role="status">
      <span>
        🌱 <strong>A new version is ready</strong> ({versionLabel(latest.version, latest.build)}). Updating keeps all your data.
      </span>
      <span className="banner-actions">
        <button
          className="btn primary small"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void applyUpdate();
          }}
        >
          {busy ? 'Updating…' : 'Update now'}
        </button>
        <button className="btn ghost small" onClick={() => setLater(latest.build)}>Later</button>
      </span>
    </div>
  );
}

function Notes({ releases }: { releases: Release[] }) {
  return (
    <>
      {releases.map((r) => (
        <section key={r.version} className="release">
          <h3>
            Version {r.version} <small>{prettyDate(r.date + 'T12:00:00')}</small>
          </h3>
          <ul>
            {r.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** After an update, says so once and lets you read what changed. */
export function WhatsNewBanner() {
  const [seen] = useState(() => seenVersion());
  const [show, setShow] = useState(() => {
    if (seen === null) {
      // first time on this device: nothing to compare with, so just remember the version
      markSeenVersion(__APP_VERSION__);
      return false;
    }
    return seen !== __APP_VERSION__;
  });
  const [open, setOpen] = useState(false);
  if (!show) return null;
  const done = () => {
    markSeenVersion(__APP_VERSION__);
    setShow(false);
    setOpen(false);
  };
  return (
    <>
      <div className="banner" role="status">
        <span>🌼 Petalkeeper updated to <strong>v{__APP_VERSION__}</strong>.</span>
        <span className="banner-actions">
          <button className="btn primary small" onClick={() => setOpen(true)}>See what's new</button>
          <button className="btn ghost small" onClick={done} aria-label="Dismiss the update note">✕</button>
        </span>
      </div>
      {open && (
        <Modal title="What's new" onClose={done}>
          <Notes releases={releasesSince(seen)} />
          <div className="actions">
            <button className="btn primary" data-autofocus onClick={done}>Got it</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** The full list of changes, for the Garden Shed. */
export function WhatsNewList() {
  return (
    <details className="whatsnew">
      <summary>What's new in each version</summary>
      <Notes releases={CHANGELOG} />
    </details>
  );
}

/** Warns when saving fails or this browser's storage is getting full, before anything is lost. */
export function StorageBanner({ onOpen }: { onOpen: () => void }) {
  const { saveFailed, data } = useStore();
  const [health, setHealth] = useState<Health | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => void storageHealth().then((h) => alive && setHealth(h)), 1500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [data]);

  if (saveFailed) {
    return (
      <div className="banner bad" role="alert">
        <span>⚠️ <strong>This browser couldn't save your latest changes</strong> (private mode or full storage). Export a backup so nothing is lost.</span>
        <span className="banner-actions">
          <button className="btn small" onClick={onOpen}>Open backup</button>
        </span>
      </div>
    );
  }
  if (hidden || !health || health.ratio < WARN_AT) return null;
  return (
    <div className="banner bad" role="status">
      <span>⚠️ This browser's storage is {health.text}. Export a backup, then clear out old things you no longer need.</span>
      <span className="banner-actions">
        <button className="btn small" onClick={onOpen}>Open backup</button>
        <button className="btn ghost small" onClick={() => setHidden(true)}>Not now</button>
      </span>
    </div>
  );
}
