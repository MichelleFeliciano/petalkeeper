import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from './store';
import {
  SyncError,
  forCloud,
  getRemote,
  getVersion,
  listVersions,
  loadBase,
  loadSyncConfig,
  pushReplace,
  putRemote,
  runSync,
  saveBase,
  saveSyncConfig,
  stable,
  testConnection,
  type SyncConfig,
  type Version,
} from './lib/sync';
import type { AppData } from './lib/types';

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';
export type ConnectChoice = 'cloud' | 'device' | 'merge';

interface Pending {
  cfg: SyncConfig;
  remote: AppData;
}

export interface SyncApi {
  config: SyncConfig | null;
  status: SyncStatus;
  error: string;
  lastSync: string | null;
  /** set when the cloud already holds data and the user must choose what to do */
  pending: { cloudTasks: number; deviceTasks: number } | null;
  connect: (repo: string, token: string, passphrase?: string) => Promise<'connected' | 'choose'>;
  versions: () => Promise<Version[]>;
  /** preview what an earlier version holds */
  peekVersion: (sha: string) => Promise<AppData>;
  restore: (sha: string) => Promise<void>;
  /** turn encryption of the cloud copy on (a passphrase) or off (null) */
  setPassphrase: (p: string | null) => Promise<void>;
  choose: (c: ConnectChoice) => Promise<void>;
  cancelConnect: () => void;
  syncNow: () => Promise<void>;
  disconnect: () => void;
  setAuto: (on: boolean) => void;
}

const Ctx = createContext<SyncApi | null>(null);

const message = (e: unknown) => (e instanceof SyncError ? e.message : 'Something went wrong while syncing.');

export function SyncProvider({ children }: { children: ReactNode }) {
  const { data, replaceAll } = useStore();
  const [config, setConfig] = useState<SyncConfig | null>(loadSyncConfig);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const baseRef = useRef<AppData | null>(loadBase());
  const busy = useRef(false);

  const syncNow = useCallback(async () => {
    if (!config || busy.current) return;
    busy.current = true;
    setStatus('syncing');
    setError('');
    const snapshot = dataRef.current;
    try {
      const { merged } = await runSync(config, snapshot, baseRef.current);
      if (stable(dataRef.current) === stable(snapshot)) {
        if (stable(merged) !== stable(snapshot)) replaceAll(merged);
        baseRef.current = merged;
        saveBase(merged);
        setLastSync(new Date().toISOString());
        setStatus('ok');
      } else {
        // edited while syncing: keep those edits; the next sync will pick everything up
        setStatus('idle');
      }
    } catch (e) {
      setStatus('error');
      setError(message(e));
    } finally {
      busy.current = false;
    }
  }, [config, replaceAll]);

  // push local edits shortly after they happen
  useEffect(() => {
    if (!config?.auto) return;
    const base = baseRef.current;
    if (base && stable(data) === stable(base)) return;
    const t = setTimeout(() => void syncNow(), 2500);
    return () => clearTimeout(t);
  }, [data, config, syncNow, lastSync, status === 'idle']); // eslint-disable-line react-hooks/exhaustive-deps

  // pull changes from other devices on open, on return to the tab, when back online, and every so often
  useEffect(() => {
    if (!config?.auto) return;
    void syncNow();
    const visible = () => document.visibilityState === 'visible' && void syncNow();
    const t = setInterval(visible, 90_000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', visible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', visible);
    };
  }, [config?.repo, config?.token, config?.auto, syncNow]);

  const finish = (cfg: SyncConfig, base: AppData) => {
    baseRef.current = base;
    saveBase(base);
    saveSyncConfig(cfg);
    setConfig(cfg);
    setPending(null);
    setLastSync(new Date().toISOString());
    setStatus('ok');
    setError('');
  };

  const api: SyncApi = {
    config,
    status,
    error,
    lastSync,
    pending: pending ? { cloudTasks: pending.remote.tasks.length, deviceTasks: dataRef.current.tasks.length } : null,
    connect: async (repo, token, passphrase) => {
      const cfg: SyncConfig = { repo: repo.trim(), token: token.trim(), path: 'petalkeeper.json', auto: true, ...(passphrase?.trim() ? { passphrase: passphrase.trim() } : {}) };
      await testConnection(cfg);
      const remote = await getRemote(cfg);
      if (!remote.data) {
        await putRemote(cfg, forCloud(dataRef.current), undefined);
        finish(cfg, dataRef.current);
        return 'connected';
      }
      setPending({ cfg, remote: remote.data });
      return 'choose';
    },
    choose: async (choice) => {
      if (!pending) return;
      const { cfg, remote } = pending;
      const local = dataRef.current;
      if (choice === 'cloud') {
        const next = { ...remote, settings: { ...remote.settings, notifications: local.settings.notifications } };
        replaceAll(next);
        finish(cfg, next);
      } else if (choice === 'device') {
        await pushReplace(cfg, local);
        finish(cfg, local);
      } else {
        const { merged } = await runSync(cfg, local, null);
        replaceAll(merged);
        finish(cfg, merged);
      }
    },
    cancelConnect: () => setPending(null),
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
    },
    syncNow,
    disconnect: () => {
      saveSyncConfig(null);
      saveBase(null);
      baseRef.current = null;
      setConfig(null);
      setStatus('idle');
      setError('');
      setLastSync(null);
    },
    setAuto: (on) => {
      if (!config) return;
      const next = { ...config, auto: on };
      saveSyncConfig(next);
      setConfig(next);
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSync(): SyncApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSync outside SyncProvider');
  return c;
}
