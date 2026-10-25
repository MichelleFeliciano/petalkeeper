import { useState } from 'react';
import { useSync } from '../sync';
import { Modal } from './Modal';
import { daysLeft, type Version } from '../lib/sync';
import { useStore } from '../store';
import type { AppData } from '../lib/types';

const when = (iso: string) => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'unknown time');

/** Encryption and going back to an earlier saved version. */
function PrivacyAndHistory({ run, busy, err }: { run: (fn: () => Promise<unknown>) => Promise<void>; busy: boolean; err: string }) {
  const sync = useSync();
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [list, setList] = useState<Version[] | null>(null);
  const [pick, setPick] = useState<{ v: Version; data: AppData } | null>(null);
  const encrypted = !!sync.config?.passphrase;
  return (
    <details className="sync-more">
      <summary>Privacy &amp; earlier versions</summary>
      <h3>Encryption {encrypted ? '(on)' : '(off)'}</h3>
      {encrypted ? (
        <>
          <p className="hint">Your cloud copy is scrambled with your passphrase, so even someone who could open the repository would only see gibberish. Other devices need the same passphrase when they connect.</p>
          <button className="btn" disabled={busy} onClick={() => void run(() => sync.setPassphrase(null))}>Turn encryption off</button>
          <p className="hint">Turn it off on every device, or a device that still has the passphrase will turn it back on.</p>
        </>
      ) : (
        <>
          <p className="hint">Optional. Scrambles the cloud copy with a passphrase only you know. <strong>If you forget it, the cloud copy can't be recovered</strong>, though the data on your devices stays safe.</p>
          <label>
            Passphrase
            <input type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <label>
            Type it again
            <input type="password" autoComplete="off" value={again} onChange={(e) => setAgain(e.target.value)} />
          </label>
          <button
            className="btn"
            disabled={busy || pass.length < 6 || pass !== again}
            onClick={() =>
              void run(async () => {
                await sync.setPassphrase(pass);
                setPass('');
                setAgain('');
              })
            }
          >
            Encrypt my cloud copy
          </button>
          {pass.length > 0 && pass.length < 6 && <p className="hint">Use at least 6 characters.</p>}
          {pass.length >= 6 && again && pass !== again && <p className="hint">The two don't match yet.</p>}
        </>
      )}
      <h3>Earlier versions</h3>
      <p className="hint">Every sync is saved. If something was deleted by mistake, you can go back to how things were.</p>
      <button className="btn" disabled={busy} onClick={() => void run(async () => setList(await sync.versions()))}>Show earlier versions</button>
      {err && <p className="error" role="alert">{err}</p>}
      {list && (
        <Modal title="Go back to an earlier version" onClose={() => { setList(null); setPick(null); }}>
          {!pick ? (
            <>
              {list.length === 0 && <p>No earlier versions yet.</p>}
              <ul className="versions">
                {list.map((v) => (
                  <li key={v.sha}>
                    <button className="btn" disabled={busy} onClick={() => void run(async () => setPick({ v, data: await sync.peekVersion(v.sha) }))}>
                      {when(v.date)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>
                The version from <strong>{when(pick.v.date)}</strong> has {pick.data.tasks.length} activit{pick.data.tasks.length === 1 ? 'y' : 'ies'} and {pick.data.routines.length} routine{pick.data.routines.length === 1 ? '' : 's'}.
              </p>
              <p className="hint">Restoring replaces what's on this device and in the cloud. Your other devices will follow on their next sync. Consider exporting a backup first.</p>
              <div className="actions">
                <button className="btn" onClick={() => setPick(null)}>Back</button>
                <button className="btn primary" disabled={busy} onClick={() => void run(async () => { await sync.restore(pick.v.sha); setPick(null); setList(null); })}>
                  Restore this version
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </details>
  );
}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/** When the access token runs out, and a way to swap in a new one without disconnecting. */
function TokenInfo({ run, busy, err }: { run: (fn: () => Promise<unknown>) => Promise<void>; busy: boolean; err: string }) {
  const sync = useSync();
  const { today } = useStore();
  const [token, setToken] = useState('');
  const [exp, setExp] = useState('');
  const left = daysLeft(sync.config?.tokenExpires, today);
  return (
    <details className="sync-more" open={left !== null && left <= 14}>
      <summary>Access token{left !== null ? (left <= 0 ? ' (expired)' : ` (expires in ${left} day${left === 1 ? '' : 's'})`) : ''}</summary>
      {left !== null && left <= 14 && (
        <p className="error" role="alert">
          {left <= 0 ? 'Your token has expired, so syncing has stopped.' : `Your token expires in ${left} day${left === 1 ? '' : 's'}.`} Make a new one on GitHub (Settings → Developer settings → Fine-grained tokens), then paste it below.
        </p>
      )}
      <label>
        Token expires on (optional, so I can warn you)
        <input type="date" value={sync.config?.tokenExpires ?? ''} onChange={(e) => sync.setTokenExpires(e.target.value || undefined)} />
      </label>
      <label>
        New token
        <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <label>
        New token expires on (optional)
        <input type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
      </label>
      <button
        className="btn"
        disabled={busy || !token.trim()}
        onClick={() =>
          void run(async () => {
            await sync.replaceToken(token, exp || undefined);
            setToken('');
            setExp('');
            await sync.syncNow();
          })
        }
      >
        Replace token
      </button>
      {err && <p className="error" role="alert">{err}</p>}
    </details>
  );
}

export function SyncPanel() {
  const sync = useSync();
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [expires, setExpires] = useState('');
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
          <TokenInfo run={run} busy={busy} err={err} />
          <PrivacyAndHistory run={run} busy={busy} err={err} />
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
                const r = await sync.connect(repo, token, passphrase, expires || undefined);
                if (r === 'connected') {
                  setToken('');
                  setPassphrase('');
                }
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
            <label>
              Token expires on (optional, so I can warn you before it stops working)
              <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </label>
            <label>
              Passphrase (only if your cloud copy is encrypted)
              <input type="password" autoComplete="off" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
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
