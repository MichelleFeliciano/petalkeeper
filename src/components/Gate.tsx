import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { checkPin, hasPin, markTourSeen, tourSeen } from '../lib/device';
import { isFreshSample } from '../lib/storage';
import { useStore } from '../store';
import { loadSyncConfig } from '../lib/sync';

const RELOCK_AFTER_MS = 2 * 60 * 1000;

/** Asks for the PIN on open, and again after the app has been out of sight for a couple of minutes. Only if a PIN is set. */
export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(hasPin);
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const on = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS && hasPin()) setLocked(true);
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  if (!locked) return <>{children}</>;
  return (
    <div className="lock">
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          if (checkPin(pin)) {
            setLocked(false);
            setPin('');
            setWrong(false);
          } else {
            setWrong(true);
            setPin('');
          }
        }}
      >
        <h1>Petalkeeper</h1>
        <p>Enter your PIN to open your garden.</p>
        <label>
          PIN
          <input type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        {wrong && <p className="error" role="alert">That's not it. Try again.</p>}
        <div className="actions left">
          <button className="btn primary" type="submit" disabled={!pin}>Open</button>
        </div>
      </form>
    </div>
  );
}

/** A short welcome the first time the app opens on a device. */
export function Tour() {
  const { resetEverything } = useStore();
  const [open, setOpen] = useState(() => !tourSeen());
  // only offer this when the app is showing its built-in examples (not data that arrived from another device)
  const examples = isFreshSample() && !loadSyncConfig();
  if (!open) return null;
  const close = () => {
    markTourSeen();
    setOpen(false);
  };
  return (
    <Modal title="Welcome to your garden" onClose={close}>
      <ul className="tour">
        <li>🌿 <strong>Daily Rituals</strong> holds your routines for each part of the day, like Wake-up or Bedtime. No clock needed. Start from a ready-made one or plant your own.</li>
        <li>🌼 <strong>Today's Garden</strong> shows the next step to do and everything for today. Pause routines or switch on a gentle day whenever you need to rest.</li>
        <li>🗓️ <strong>The Garden Path</strong> is your week; the <strong>Seed Pouch</strong> holds tasks with no date yet.</li>
        <li>🧺 <strong>Garden Shed</strong> is where backups, syncing between your devices, text size and a private PIN live.</li>
        <li>Everything stays on your devices. Nothing here is ever scored or counted against you.</li>
      </ul>
      {examples && <p className="hint">The tasks and routines you see are just examples to look around with.</p>}
      <div className="actions">
        {examples && (
          <button
            className="btn"
            onClick={() => {
              resetEverything();
              close();
            }}
          >
            Start with an empty garden
          </button>
        )}
        <button className="btn primary" data-autofocus onClick={close}>{examples ? 'Keep the examples for now' : 'Got it'}</button>
      </div>
    </Modal>
  );
}
