import { readFileSync, writeFileSync } from 'node:fs';
import { sub } from './lib.mjs';

/* ---------- Shed ---------- */
const SH = 'src/pages/Shed.tsx';
// replace the local update helpers with the shared ones
{
  const raw = readFileSync(SH, 'utf8').replace(/\r\n/g, '\n');
  const a = raw.indexOf("const when = (iso: string)");
  const b = raw.indexOf('/** A number box that lets you clear it');
  if (a < 0 || b < 0) throw new Error('shed markers');
  const helper = `const label = versionLabel;

/** Looks for a newer published version; only reloads when there really is one. */
async function updateApp(setNote: (t: string) => void) {
  const mine = label(__APP_VERSION__, __APP_BUILD__);
  setNote('Checking for a new version…');
  const latest = await fetchLatest();
  if (!latest) {
    setNote(\`Couldn't check right now. You may be offline. You're on \${mine}.\`);
    return;
  }
  if (!isNewer(latest)) {
    setNote(\`You're on the newest version, \${mine}. Nothing to update.\`);
    return;
  }
  setNote(\`Updating from \${mine} to \${label(latest.version, latest.build)}…\`);
  await applyUpdate();
}

`;
  writeFileSync(SH, raw.slice(0, a) + helper + raw.slice(b));
}
sub(SH, "import { useSync } from '../sync';", "import { useSync } from '../sync';\nimport { applyUpdate, CACHE_NAME, fetchLatest, isNewer, versionLabel } from '../lib/update';\nimport { WhatsNewList } from '../components/Banners';\nimport { DeletedPanel, HistoryPanel, ImportCheck, SettingsCheck, type PendingImport } from '../components/DataSafety';");
sub(SH, "const JUMPS: [string, string][] = [\n  ['pref-h', 'Preferences'],", "const JUMPS: [string, string][] = [\n  ['chk-h', 'Check'],\n  ['pref-h', 'Preferences'],");
sub(SH, "  ['bk-h', 'Backup'],\n", "  ['bk-h', 'Backup'],\n  ['hx-h', 'History'],\n  ['tr-h', 'Deleted'],\n");
sub(SH, "      <JumpBar />\n", "      <JumpBar />\n\n      <SettingsCheck />\n");
sub(SH, "  const [updNote, setUpdNote] = useState('');", "  const [updNote, setUpdNote] = useState('');\n  const [pending, setPending] = useState<PendingImport | null>(null);");
sub(SH, `  const importFile = async (file: File) => {
    const res = parseImport(await file.text());
    if (!res.ok) return setMsg({ ok: false, text: \`\${res.error} Your current data was not changed.\` });
    s.replaceAll(res.data);
    setMsg({ ok: true, text: \`Restored \${res.data.tasks.length} activities and \${res.data.routines.length} routines.\` });
  };`, `  const importFile = async (file: File) => {
    const text = await file.text();
    let meta: { app?: unknown; appVersion?: unknown; exportedAt?: unknown } = {};
    try {
      meta = JSON.parse(text) ?? {};
    } catch {
      /* parseImport explains it */
    }
    if (typeof meta.app === 'string' && meta.app !== 'petalkeeper') return setMsg({ ok: false, text: \`That file is from \${meta.app}, not Petalkeeper. Your current data was not changed.\` });
    const res = parseImport(text);
    if (!res.ok) return setMsg({ ok: false, text: \`\${res.error} Your current data was not changed.\` });
    const from = [
      typeof meta.appVersion === 'string' ? \`made by Petalkeeper v\${meta.appVersion}\` : '',
      typeof meta.exportedAt === 'string' && !Number.isNaN(Date.parse(meta.exportedAt)) ? \`saved \${new Date(meta.exportedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}\` : '',
    ].filter(Boolean).join(', ');
    setMsg(null);
    setPending({ data: res.data, from, fileName: file.name });
  };`);
sub(SH, "<button className=\"btn\" onClick={() => fileRef.current?.click()}>Import backup…</button>", "<button className=\"btn\" onClick={() => fileRef.current?.click()}>Import backup (check first)…</button>");
sub(SH, "        {s.saveFailed && <p className=\"error\" role=\"alert\">This browser couldn't save your data (private mode or full storage). Please export a backup.</p>}\n      </section>\n", "        {s.saveFailed && <p className=\"error\" role=\"alert\">This browser couldn't save your data (private mode or full storage). Please export a backup.</p>}\n      </section>\n\n      <HistoryPanel />\n\n      <DeletedPanel />\n");
sub(SH, "        {updNote && <p role=\"status\" aria-live=\"polite\" className=\"ok-msg\">{updNote}</p>}\n      </section>", "        {updNote && <p role=\"status\" aria-live=\"polite\" className=\"ok-msg\">{updNote}</p>}\n        <p className=\"hint\">Last updated {new Date(__APP_BUILD__).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. Offline copy: {CACHE_NAME}. A banner also appears by itself when a newer version is ready.</p>\n        <WhatsNewList />\n      </section>");
sub(SH, "      {confirm && (\n        <Modal title={confirm === 'all'", "      {pending && (\n        <ImportCheck\n          pending={pending}\n          onClose={() => setPending(null)}\n          onDone={(text) => {\n            setPending(null);\n            setMsg({ ok: true, text });\n          }}\n        />\n      )}\n\n      {confirm && (\n        <Modal title={confirm === 'all'");

/* ---------- Tour can be replayed ---------- */
const G = 'src/components/Gate.tsx';
sub(G, "  const [open, setOpen] = useState(() => !tourSeen());\n  // only offer this when the app is showing its built-in examples (not data that arrived from another device)\n  const examples = isFreshSample() && !loadSyncConfig();",
  "  const [open, setOpen] = useState(() => !tourSeen());\n  const [replay, setReplay] = useState(false);\n  useEffect(() => {\n    const again = () => {\n      setReplay(true);\n      setOpen(true);\n    };\n    window.addEventListener('petalkeeper:tour', again);\n    return () => window.removeEventListener('petalkeeper:tour', again);\n  }, []);\n  // only offer this when the app is showing its built-in examples (not data that arrived from another device), and never when it is shown again later\n  const examples = !replay && isFreshSample() && !loadSyncConfig();");

/* ---------- App: top bar, banners, search, help, version ---------- */
const A = 'src/App.tsx';
sub(A, "import { Journal } from './pages/Journal';", "import { Journal } from './pages/Journal';\nimport { StorageBanner, UpdateBanner, WhatsNewBanner } from './components/Banners';\nimport { HelpModal, SearchModal } from './components/Finder';\nimport { versionLabel } from './lib/update';");
sub(A, "  useShareTarget(go);\n", "  useShareTarget(go);\n  const [finder, setFinder] = useState<'search' | 'help' | null>(null);\n  useEffect(() => {\n    const on = (e: KeyboardEvent) => {\n      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {\n        e.preventDefault();\n        setFinder('search');\n      }\n    };\n    window.addEventListener('keydown', on);\n    return () => window.removeEventListener('keydown', on);\n  }, []);\n  const openBackup = () => {\n    go('shed');\n    setTimeout(() => document.getElementById('bk-h')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 50);\n  };\n");
sub(A, "        <SyncChip variant=\"side\" onOpen={() => go('shed')} />\n      </aside>", "        <SyncChip variant=\"side\" onOpen={() => go('shed')} />\n        <p className=\"side-version\">{versionLabel(__APP_VERSION__, __APP_BUILD__)}</p>\n      </aside>");
sub(A, "        <SyncChip variant=\"top\" onOpen={() => go('shed')} />\n        <OfflineNote />", "        <div className=\"topbar\">\n          <SyncChip variant=\"top\" onOpen={() => go('shed')} />\n          <span className=\"topbar-actions\">\n            <button className=\"btn ghost small\" onClick={() => setFinder('search')} aria-label=\"Search\" title=\"Search (Ctrl+K)\">🔍 <span className=\"lbl-s\">Search</span></button>\n            <button className=\"btn ghost small\" onClick={() => setFinder('help')} aria-label=\"Help\">❓ <span className=\"lbl-s\">Help</span></button>\n          </span>\n        </div>\n        <UpdateBanner />\n        <WhatsNewBanner />\n        <StorageBanner onOpen={openBackup} />\n        <OfflineNote />");
sub(A, "      <ToastBar />\n      <Tour />", "      <ToastBar />\n      <Tour />\n      {finder === 'search' && <SearchModal onClose={() => setFinder(null)} onGo={go} />}\n      {finder === 'help' && <HelpModal onClose={() => setFinder(null)} onWelcome={() => window.dispatchEvent(new Event('petalkeeper:tour'))} />}");

/* ---------- empty screens: Add one now ---------- */
sub('src/pages/Seeds.tsx', "            : 'Nothing here right now. Your garden is at peace.'}\n        </p>\n      )}", "            : 'Nothing here right now. Your garden is at peace.'}\n        </p>\n      )}\n      {list.length === 0 && !q && (filter === 'all' || filter === 'unscheduled') && (\n        <div className=\"actions left\">\n          <button className=\"btn primary\" onClick={() => openForm()}>Add one now</button>\n        </div>\n      )}");
sub('src/pages/Today.tsx', "{flexible.length === 0 ? <p className=\"empty\">No flexible tasks today.</p> : flexible.map((o) => <TaskCard key={o.key} occ={o} />)}", "{flexible.length === 0 ? (\n          <>\n            <p className=\"empty\">No flexible tasks today.</p>\n            <div className=\"actions left\">\n              <button className=\"btn\" onClick={() => openForm(undefined, { date: today })}>Add one now</button>\n            </div>\n          </>\n        ) : (\n          flexible.map((o) => <TaskCard key={o.key} occ={o} />)\n        )}");
sub('src/pages/Rituals.tsx', "{list.length === 0 && <p className=\"empty\">No {part.label.toLowerCase()} routine yet. Plant one whenever you like, or start from a ready-made one below.</p>}", "{list.length === 0 && (\n        <>\n          <p className=\"empty\">No {part.label.toLowerCase()} routine yet. Plant one whenever you like, or start from a ready-made one below.</p>\n          <div className=\"actions left\">\n            <button className=\"btn\" onClick={() => addRoutine(kind, `New ${part.label.toLowerCase()} routine`)}>Add one now</button>\n          </div>\n        </>\n      )}");
