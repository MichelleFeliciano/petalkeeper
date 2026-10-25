import { sub } from './lib.mjs';
const S = 'src/sync.tsx';
sub(S, "  getRemote,\n  loadBase,", "  getRemote,\n  getVersion,\n  listVersions,\n  loadBase,");
sub(S, "  testConnection,\n  type SyncConfig,\n} from './lib/sync';", "  testConnection,\n  type SyncConfig,\n  type Version,\n} from './lib/sync';");
sub(S, "  connect: (repo: string, token: string) => Promise<'connected' | 'choose'>;", "  connect: (repo: string, token: string, passphrase?: string) => Promise<'connected' | 'choose'>;\n  versions: () => Promise<Version[]>;\n  /** preview what an earlier version holds */\n  peekVersion: (sha: string) => Promise<AppData>;\n  restore: (sha: string) => Promise<void>;\n  /** turn encryption of the cloud copy on (a passphrase) or off (null) */\n  setPassphrase: (p: string | null) => Promise<void>;");
sub(S, "    connect: async (repo, token) => {\n      const cfg: SyncConfig = { repo: repo.trim(), token: token.trim(), path: 'petalkeeper.json', auto: true };",
  "    connect: async (repo, token, passphrase) => {\n      const cfg: SyncConfig = { repo: repo.trim(), token: token.trim(), path: 'petalkeeper.json', auto: true, ...(passphrase?.trim() ? { passphrase: passphrase.trim() } : {}) };");
sub(S, "    cancelConnect: () => setPending(null),", `    cancelConnect: () => setPending(null),
    versions: async () => {
      if (!config) return [];
      return listVersions(config);
    },
    peekVersion: async (sha) => {
      if (!config) throw new SyncError('invalid', 'Sync is not connected.');
      return getVersion(config, sha);
    },
    restore: async (sha) => {
      if (!config) return;
      const old = await getVersion(config, sha);
      const next = { ...old, settings: { ...old.settings, notifications: dataRef.current.settings.notifications } };
      await pushReplace(config, next);
      replaceAll(next);
      baseRef.current = next;
      saveBase(next);
      setLastSync(new Date().toISOString());
      setStatus('ok');
    },
    setPassphrase: async (p) => {
      if (!config) return;
      // bring in anything other devices added first, so nothing is lost by re-saving the cloud copy
      const { merged } = await runSync(config, dataRef.current, baseRef.current);
      const { passphrase: _old, ...rest } = config;
      void _old;
      const next: SyncConfig = p ? { ...rest, passphrase: p } : rest;
      await pushReplace(next, merged);
      saveSyncConfig(next);
      setConfig(next);
      replaceAll(merged);
      baseRef.current = merged;
      saveBase(merged);
      setLastSync(new Date().toISOString());
      setStatus('ok');
    },`);
