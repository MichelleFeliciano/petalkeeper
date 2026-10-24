import { describe, expect, it } from 'vitest';
import { mergeData, runSync, SyncError, testConnection, getRemote, type SyncConfig } from '../lib/sync';
import * as ops from '../lib/ops';
import { makeTask } from '../lib/schedule';
import { emptyForTest } from './helpers';
import type { AppData } from '../lib/types';

const cfg: SyncConfig = { repo: 'me/data', token: 't', path: 'petalkeeper.json', auto: true };

/** A tiny in-memory stand-in for GitHub's contents API. */
function fakeGitHub(opts: { isPrivate?: boolean } = {}) {
  let content: string | null = null;
  let sha = 0;
  let puts = 0;
  let failNextPutWithConflict = false;
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    if (!(init?.headers as Record<string, string>)?.Authorization?.startsWith('Bearer t')) return json({}, 401);
    if (url.endsWith('/repos/me/data')) return json({ private: opts.isPrivate ?? true });
    if (url.includes('/contents/')) {
      if (!init?.method || init.method === 'GET') {
        return content === null ? json({}, 404) : json({ content: content, sha: String(sha) });
      }
      const body = JSON.parse(String(init.body));
      if (failNextPutWithConflict) {
        failNextPutWithConflict = false;
        return json({}, 409);
      }
      if (content !== null && body.sha !== String(sha)) return json({}, 409);
      content = body.content;
      sha++;
      puts++;
      return json({ content: { sha: String(sha) } });
    }
    return json({}, 404);
  }) as typeof fetch;
  return { f, puts: () => puts, conflictNext: () => (failNextPutWithConflict = true) };
}

const withTask = (d: AppData, title: string, id: string) => ops.addTask(d, makeTask({ id, title, date: '2026-03-02' }));

describe('three-way merge', () => {
  const base = withTask(withTask(emptyForTest(), 'A', 'a'), 'B', 'b');

  it('combines edits made on two devices', () => {
    const phone = withTask(base, 'C (phone)', 'c');
    const computer = ops.updateTask(base, 'a', { title: 'A edited' });
    const m = mergeData(base, phone, computer);
    expect(m.tasks.map((t) => t.title).sort()).toEqual(['A edited', 'B', 'C (phone)']);
  });

  it('propagates deletions', () => {
    const computer = ops.deleteTask(base, 'b');
    const m = mergeData(base, base, computer);
    expect(m.tasks.map((t) => t.id)).toEqual(['a']);
    // and the other direction
    expect(mergeData(base, computer, base).tasks.map((t) => t.id)).toEqual(['a']);
  });

  it('keeps an item that was edited on one device and deleted on the other', () => {
    const edited = ops.updateTask(base, 'b', { title: 'B edited' });
    const deleted = ops.deleteTask(base, 'b');
    expect(mergeData(base, edited, deleted).tasks.map((t) => t.title).sort()).toEqual(['A', 'B edited']);
    expect(mergeData(base, deleted, edited).tasks.map((t) => t.title).sort()).toEqual(['A', 'B edited']);
  });

  it('this device wins when both changed the same item', () => {
    const l = ops.updateTask(base, 'a', { title: 'local' });
    const r = ops.updateTask(base, 'a', { title: 'remote' });
    expect(mergeData(base, l, r).tasks.find((t) => t.id === 'a')?.title).toBe('local');
  });

  it('with no base, unions both sides', () => {
    const l = withTask(emptyForTest(), 'L', 'l');
    const r = withTask(emptyForTest(), 'R', 'r');
    expect(mergeData(null, l, r).tasks.map((t) => t.id).sort()).toEqual(['l', 'r']);
  });

  it('merges routine progress from both devices and keeps blooms', () => {
    const b = emptyForTest();
    const l = ops.toggleStep({ ...b, blooms: 2 }, '2026-03-02', 'r1', 's1');
    const r = ops.toggleStep({ ...b, blooms: 5 }, '2026-03-02', 'r1', 's2');
    const m = mergeData(b, l, r);
    expect(m.routineLog['2026-03-02']['r1'].done.sort()).toEqual(['s1', 's2']);
    expect(m.blooms).toBe(6); // the larger of the two devices (5 + 1 step done)
  });

  it('does not sync the per-device reminders switch', () => {
    const l = { ...base, settings: { ...base.settings, notifications: true } };
    const r = { ...base, settings: { ...base.settings, notifications: false, theme: 'dark' as const } };
    const m = mergeData(base, l, r);
    expect(m.settings.notifications).toBe(true);
    expect(m.settings.theme).toBe('dark');
  });
});

describe('GitHub client', () => {
  it('rejects bad names, bad tokens and public repos', async () => {
    const gh = fakeGitHub();
    await expect(testConnection({ ...cfg, repo: 'nonsense' }, gh.f)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(testConnection({ ...cfg, token: 'bad' }, gh.f)).rejects.toMatchObject({ kind: 'auth' });
    await expect(testConnection(cfg, fakeGitHub({ isPrivate: false }).f)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(testConnection(cfg, gh.f)).resolves.toBeUndefined();
  });

  it('two devices stay in step, and an unchanged sync does not write again', async () => {
    const gh = fakeGitHub();
    // computer creates the cloud copy
    const computer0 = withTask(emptyForTest(), 'From computer', 'x');
    const first = await runSync(cfg, computer0, null, gh.f);
    expect(first.pushed).toBe(true);
    // phone connects with no base: pulls what's there and adds its own
    const phone0 = withTask(emptyForTest(), 'From phone', 'y');
    const phone = await runSync(cfg, phone0, null, gh.f);
    expect(phone.merged.tasks.map((t) => t.id).sort()).toEqual(['x', 'y']);
    // computer syncs again and receives the phone's task
    const second = await runSync(cfg, first.merged, first.merged, gh.f);
    expect(second.merged.tasks).toHaveLength(2);
    // nothing changed -> no extra write
    const before = gh.puts();
    const again = await runSync(cfg, second.merged, second.merged, gh.f);
    expect(again.pushed).toBe(false);
    expect(gh.puts()).toBe(before);
  });

  it('retries when the cloud copy moves during a sync', async () => {
    const gh = fakeGitHub();
    await runSync(cfg, withTask(emptyForTest(), 'one', 'a'), null, gh.f);
    gh.conflictNext();
    const r = await runSync(cfg, withTask(emptyForTest(), 'two', 'b'), null, gh.f);
    expect(r.merged.tasks).toHaveLength(2);
  });

  it('refuses to touch local data if the cloud file is garbage', async () => {
    const f = (async (u: RequestInfo | URL) =>
      String(u).includes('/contents/')
        ? new Response(JSON.stringify({ content: btoa('{"version":1,"tasks":"nope"}'), sha: '1' }))
        : new Response('{}')) as typeof fetch;
    await expect(getRemote(cfg, f)).rejects.toBeInstanceOf(SyncError);
    await expect(runSync(cfg, emptyForTest(), null, f)).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('reports network failures kindly', async () => {
    const f = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    await expect(runSync(cfg, emptyForTest(), null, f)).rejects.toMatchObject({ kind: 'network' });
  });
});
