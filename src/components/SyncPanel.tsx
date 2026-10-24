import { useState } from 'react';
import { useSync } from '../sync';
import { Modal } from './Modal';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

export function SyncPanel() {
  const sync = useSync();
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card form" aria-labelledby="sy-h">
      <h2 id="sy-h">Sync between devices</h2>
      {sync.config ? (
        <>
          <p>
            Connected to <strong>{sync.config.repo}</strong>.{' '}
            {sync.status === 'syncing' && 'Syncing…'}
            {sync.status === 'ok' && sync.lastSync && `Up to date (${new Date(sync.lastSync).toLocaleTimeString()}).`}
          </p>
          {sync.status === 'error' && (
            <p className="error" role="alert">
              {sync.error} Your data on this device is safe.
            </p>
          )}
          <label className="inline">
            <input type="checkbox" checked={sync.config.auto} onChange={(e) => sync.setAuto(e.target.checked)} /> Sync automatically
          </label>
          <div className="actions left">
            <button className="btn primary" onClick={() => void sync.syncNow()} disabled={sync.status === 'syncing'}>
              Sync now
            </button>
            <button className="btn" onClick={sync.disconnect}>
              Disconnect this device
            </button>
          </div>
          <p className="hint">
            Disconnecting keeps everything on this device and forgets the access token. Edits from different devices are combined; if the same item was changed on two devices at once, this device's version is kept.
          </p>
        </>
      ) : (
        <>
          <p>
            Keep your phone and computer in step through a <strong>private</strong> GitHub repository that only you can open. There's no other service involved, and the token never leaves this browser.
          </p>
          <details>
            <summary>How to set it up (about 3 minutes, once)</summary>
            <ol className="steps-help">
              <li>On github.com create a new <strong>private</strong> repository, for example <code>petalkeeper-data</code>, and tick "Add a README".</li>
              <li>Go to Settings → Developer settings → Personal access tokens → <em>Fine-grained tokens</em> → Generate new token.</li>
              <li>Under "Repository access" choose <em>Only select repositories</em> and pick that one repository. Under Permissions → Repository permissions set <em>Contents</em> to <em>Read and write</em>.</li>
              <li>Copy the token, then enter the repository name and the token below. Do the same on your other device.</li>
            </ol>
          </details>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await sync.connect(repo, token);
                if (r === 'connected') setToken('');
              });
            }}
          >
            <label>
              Data repository (owner/name)
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="yourname/petalkeeper-data" autoCapitalize="none" autoCorrect="off" />
            </label>
            <label>
              Access token
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            </label>
            {err && (
              <p className="error" role="alert">
                {err}
              </p>
            )}
            <div className="actions left">
              <button className="btn primary" type="submit" disabled={busy || !repo || !token}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </form>
          <p className="hint">The token is stored only in this browser and is never included in backups. Anyone using this browser profile could use it, so only connect on devices you trust.</p>
        </>
      )}

      {sync.pending && (
        <Modal title="Your cloud copy already has data" onClose={sync.cancelConnect}>
          <p>
            The cloud has {sync.pending.cloudTasks} activit{sync.pending.cloudTasks === 1 ? 'y' : 'ies'}; this device has {sync.pending.deviceTasks}. What should happen?
          </p>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="adjust-list">
            <button className="btn primary" disabled={busy} onClick={() => void run(() => sync.choose('cloud'))}>
              Use the cloud copy here (replaces this device's data)
            </button>
            <button className="btn" disabled={busy} onClick={() => void run(() => sync.choose('merge'))}>
              Combine both
            </button>
            <button className="btn" disabled={busy} onClick={() => void run(() => sync.choose('device'))}>
              Use this device's data (replaces the cloud copy)
            </button>
          </div>
          <p className="hint">Setting up a new phone? Choose the first option.</p>
          <div className="actions">
            <button className="btn ghost" onClick={sync.cancelConnect}>Cancel</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
