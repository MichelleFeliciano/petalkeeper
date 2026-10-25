import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as ops from '../lib/ops';
import { atPlace, historyFor, isPaused, placeOn, progressOf, routinesFor, stepsFor } from '../lib/routines';
import { countdownText, daysUntil, linkify, typicalMinutes, weekdayInsight } from '../lib/journal';
import { autoBackupDue, markAutoBackup, setAutoBackup } from '../lib/device';
import { exportJSON, parseImport } from '../lib/storage';
import { decryptText, encryptText, getVersion, listVersions, mergeData, runSync, SyncError, type SyncConfig } from '../lib/sync';
import { emptyForTest } from './helpers';

const T = '2026-03-03';

beforeAll(async () => {
  // jsdom has no WebCrypto; Node's is the same API
  const nodeCrypto = await import(/* @vite-ignore */ 'node:' + 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: nodeCrypto.webcrypto, configurable: true });
});

describe('places and modes', () => {
  const base = () => {
    let d = ops.addRoutine(emptyForTest(), 'morning', 'Home morning');
    d = ops.setSteps(d, d.routines[0].id, [
      { id: 'a', title: 'Feed the cat', places: ['home'] },
      { id: 'b', title: 'Shower' },
    ]);
    return d;
  };

  it('has Home, Mom\'s, Vacation and Road trip to start with', () => {
    expect(emptyForTest().settings.places.map((p) => p.label)).toEqual(['Home', "Mom's", 'Vacation', 'Road trip']);
  });

  it('steps and routines follow where you are', () => {
    const d = base();
    const r = d.routines[0];
    expect(stepsFor(r, T, false, 'home').map((s) => s.id)).toEqual(['a', 'b']);
    expect(stepsFor(r, T, false, 'moms').map((s) => s.id)).toEqual(['b']);
    const forMoms = ops.setRoutinePlaces(d, r.id, ['moms']);
    expect(atPlace(forMoms.routines[0], 'home')).toBe(false);
    expect(routinesFor(forMoms, T)).toHaveLength(0);
    expect(routinesFor(ops.updateSettings(forMoms, { place: 'moms' }), T)).toHaveLength(1);
  });

  it('a planned stay switches the place by itself and back again', () => {
    const d = ops.addStay(emptyForTest(), 'moms', '2026-03-06', '2026-03-08');
    expect(placeOn(d.settings, '2026-03-05')).toBe('home');
    expect(placeOn(d.settings, '2026-03-07')).toBe('moms');
    expect(placeOn(d.settings, '2026-03-09')).toBe('home');
  });

  it('copy for a place leaves the original at the other places only', () => {
    const b = base();
    const d = ops.copyToPlace(b, b.routines[0].id, 'moms');
    expect(d.routines).toHaveLength(2);
    expect(d.routines[1].name).toBe("Home morning (Mom's)");
    expect(d.routines[1].places).toEqual(['moms']);
    expect(d.routines[0].places).not.toContain('moms');
    expect(routinesFor(ops.updateSettings(d, { place: 'moms' }), T).map((r) => r.name)).toEqual(["Home morning (Mom's)"]);
    expect(routinesFor(d, T).map((r) => r.name)).toEqual(['Home morning']);
  });

  it('deleting a place cleans up what pointed at it, and keeps at least one', () => {
    const b = base();
    let d = ops.setRoutinePlaces(b, b.routines[0].id, ['moms']);
    d = ops.deletePlace(d, 'moms');
    expect(d.routines[0].places).toBeUndefined();
    expect(d.settings.places.map((p) => p.id)).not.toContain('moms');
    let one = d;
    for (const p of d.settings.places.map((x) => x.id)) one = ops.deletePlace(one, p);
    expect(one.settings.places).toHaveLength(1);
  });

  it('history keeps days you did a routine away from its place, and rests the rest', () => {
    const b = base();
    let d = ops.setRoutinePlaces(b, b.routines[0].id, ['moms']);
    expect(historyFor(d, d.routines[0], [T])).toEqual(['off']);
    d = ops.toggleStep(d, T, d.routines[0].id, 'b');
    expect(historyFor(d, d.routines[0], [T])[0]).not.toBe('off');
    expect(progressOf(d, d.routines[0], T, true).done).toBe(1);
  });

  it('round-trips places and rejects nonsense', () => {
    const d = ops.addStay(ops.addPlace(base(), 'Camping', '⛺'), 'moms', T, T);
    const res = parseImport(exportJSON(d));
    expect(res.ok && res.data.settings.places.map((p) => p.label)).toContain('Camping');
    expect(res.ok && res.data.settings.stays).toHaveLength(1);
    const bad = { ...d, routines: [{ ...d.routines[0], places: 'home' }] };
    expect(parseImport(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe('journal helpers and the other new bits', () => {
  it('as-needed items remember when, and undo removes only the last tap', () => {
    let d = ops.addNeeded(emptyForTest(), 'Water plants', '🪴');
    const id = d.needed[0].id;
    d = ops.markNeeded(ops.markNeeded(d, id, '2026-03-03T08:00:00.000Z'), id, '2026-03-03T20:00:00.000Z');
    expect(d.neededLog[id]).toHaveLength(2);
    expect(ops.unmarkNeeded(d, id).neededLog[id]).toEqual(['2026-03-03T08:00:00.000Z']);
    expect(ops.deleteNeeded(d, id).neededLog[id]).toBeUndefined();
  });

  it('merges as-needed history from two devices', () => {
    const base = ops.addNeeded(emptyForTest(), 'Water plants', '🪴');
    const id = base.needed[0].id;
    const a = ops.markNeeded(base, id, '2026-03-03T08:00:00.000Z');
    const b = ops.markNeeded(base, id, '2026-03-03T09:00:00.000Z');
    expect(mergeData(base, a, b).neededLog[id]).toHaveLength(2);
  });

  it('counts down to a date and says so on the day', () => {
    expect(daysUntil('2026-03-09', T)).toBe(6);
    expect(countdownText('the trip', '2026-03-09', T)).toBe('6 days until the trip');
    expect(countdownText('the trip', T, T)).toBe('the trip is today');
    const d = ops.addCountdown(emptyForTest(), 'Trip', '✈️', '2026-03-09');
    expect(parseImport(exportJSON(d)).ok).toBe(true);
    expect(parseImport(JSON.stringify({ ...d, countdowns: [{ id: 'x', label: 'y', icon: 'z', date: 'soon' }] })).ok).toBe(false);
  });

  it('plans a rest ahead of time', () => {
    const d = ops.addPlannedPause(emptyForTest(), '2026-06-03', '2026-06-10');
    expect(isPaused(d.settings, '2026-06-05')).toBe(true);
    expect(isPaused(d.settings, '2026-06-11')).toBe(false);
    expect(ops.removePlannedPause(d, d.settings.plannedPauses[0].id).settings.plannedPauses).toHaveLength(0);
  });

  it('works out how long a routine usually takes, only from days with a start and finish', () => {
    let d = ops.addRoutine(emptyForTest(), 'morning', 'Wake-up');
    const id = d.routines[0].id;
    expect(typicalMinutes(d, id)).toBeNull();
    for (const [date, mins] of [['2026-03-01', 20], ['2026-03-02', 30], ['2026-03-03', 25]] as const) {
      d = ops.startRoutine(d, date, id, `${date}T08:00:00.000Z`);
      d = ops.finishRoutine(d, date, id, new Date(new Date(`${date}T08:00:00.000Z`).getTime() + mins * 60000).toISOString());
    }
    expect(typicalMinutes(d, id)).toEqual({ minutes: 25, samples: 3 });
    expect(ops.finishRoutine(ops.addRoutine(emptyForTest(), 'morning', 'x'), T, 'nope', 'now').routineLog).toEqual({});
  });

  it('turns links and phone numbers into links without ever using HTML', () => {
    const p = linkify('Call 555-123-4567 or see https://example.com/a now <b>hi</b>');
    expect(p.filter((x) => x.href).map((x) => x.href)).toEqual(['tel:5551234567', 'https://example.com/a']);
    expect(p.map((x) => x.text).join('')).toBe('Call 555-123-4567 or see https://example.com/a now <b>hi</b>');
  });

  it('offers a soft observation only with enough check-ins', () => {
    let d = emptyForTest();
    expect(weekdayInsight(d, T)).toBeNull();
    // 12 weeks of check-ins; Tuesdays are always low
    for (let i = 0; i < 84; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      const dow = new Date(date + 'T12:00:00').getDay();
      d = ops.setCheckin(d, date, { mood: dow === 2 ? 1 : 4 });
    }
    expect(weekdayInsight(d, '2026-03-25')).toMatch(/Tuesdays/);
  });

  it('weekly backup is opt-in and due after a week', () => {
    expect(autoBackupDue(T)).toBe(false);
    setAutoBackup(true);
    expect(autoBackupDue(T)).toBe(true);
    markAutoBackup(T);
    expect(autoBackupDue('2026-03-08')).toBe(false);
    expect(autoBackupDue('2026-03-10')).toBe(true);
  });
});

/* a stand-in GitHub that also keeps history */
function fakeGitHub() {
  let content: string | null = null;
  let sha = 0;
  const history: { sha: string; content: string; date: string }[] = [];
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/commits')) return json(history.map((h) => ({ sha: h.sha, commit: { committer: { date: h.date } } })).reverse());
    if (url.pathname.includes('/contents/')) {
      const ref = url.searchParams.get('ref');
      if (!init?.method || init.method === 'GET') {
        if (ref) {
          const h = history.find((x) => x.sha === ref);
          return h ? json({ content: h.content, sha: h.sha }) : json({}, 404);
        }
        return content === null ? json({}, 404) : json({ content, sha: String(sha) });
      }
      const body = JSON.parse(String(init.body));
      if (content !== null && body.sha !== String(sha)) return json({}, 409);
      content = body.content;
      sha++;
      history.push({ sha: String(sha), content: body.content, date: `2026-03-0${Math.min(sha, 9)}T10:00:00Z` });
      return json({ content: { sha: String(sha) } });
    }
    return json({}, 404);
  }) as typeof fetch;
  return { f, raw: () => content };
}
const cfg: SyncConfig = { repo: 'me/data', token: 't', path: 'petalkeeper.json', auto: true };

describe('encryption and earlier versions', () => {
  it('scrambles and unscrambles, and a wrong passphrase is refused', async () => {
    const wrapped = JSON.parse(await encryptText('{"hello":"world"}', 'correct horse'));
    expect(wrapped['petalkeeper-encrypted']).toBe(1);
    expect(JSON.stringify(wrapped)).not.toContain('hello');
    expect(await decryptText(wrapped, 'correct horse')).toBe('{"hello":"world"}');
    await expect(decryptText(wrapped, 'wrong')).rejects.toMatchObject({ kind: 'locked' });
  });

  it('syncs through an encrypted cloud copy, and asks for the passphrase when it is missing', async () => {
    const gh = fakeGitHub();
    const secure = { ...cfg, passphrase: 'a long passphrase' };
    const mine = ops.addTask(emptyForTest(), { ...(await import('../lib/schedule')).makeTask({ title: 'Secret thing', date: T }) });
    await runSync(secure, mine, null, gh.f);
    const stored = atob(gh.raw()!);
    expect(stored).not.toContain('Secret thing');
    const back = await runSync(secure, emptyForTest(), null, gh.f);
    expect(back.merged.tasks.map((t) => t.title)).toContain('Secret thing');
    await expect(runSync(cfg, emptyForTest(), null, gh.f)).rejects.toMatchObject({ kind: 'locked' });
    await expect(runSync({ ...cfg, passphrase: 'nope nope' }, emptyForTest(), null, gh.f)).rejects.toBeInstanceOf(SyncError);
  });

  it('lists the saved versions and reads an old one', async () => {
    const gh = fakeGitHub();
    const v1 = ops.addRoutine(emptyForTest(), 'morning', 'First');
    await runSync(cfg, v1, null, gh.f);
    const v2 = ops.deleteRoutine(v1, v1.routines[0].id);
    await runSync(cfg, v2, v1, gh.f);
    const versions = await listVersions(cfg, gh.f);
    expect(versions.length).toBeGreaterThanOrEqual(2);
    const oldest = versions[versions.length - 1];
    expect((await getVersion(cfg, oldest.sha, gh.f)).routines.map((r) => r.name)).toEqual(['First']);
  });
});

describe('screens', () => {
  it('switching to Mom\'s changes what Today shows', async () => {
    window.location.hash = '';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getAllByText('Morning Routine').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Daily Rituals/ }));
    await user.click(screen.getByRole('tab', { name: /Morning/ }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'Done editing' }));
    await user.click(screen.getByRole('button', { name: /Today's Garden/ }));
    expect(screen.getAllByText('Morning Routine').length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText('Where are you right now?'), 'moms');
    expect(screen.queryByText('Morning Routine')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Where are you right now?'), 'home');
    expect(screen.getAllByText('Morning Routine').length).toBeGreaterThan(0);
  });

  it('saves a journal note for a day', async () => {
    window.location.hash = '';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Garden Journal/ }));
    const note = screen.getByLabelText('Note for this day');
    await user.type(note, 'Quiet and slow');
    await user.tab();
    await user.type(screen.getByLabelText('Search notes'), 'quiet');
    expect(screen.getByText(/Quiet and slow/, { selector: 'span.meta' })).toBeInTheDocument();
  });

  it('adds text shared from another app to the Seed Pouch', async () => {
    window.history.pushState({}, '', '/?text=Buy%20stamps&url=https%3A%2F%2Fexample.com');
    render(<App />);
    expect(screen.getByText('Added to your Seed Pouch.')).toBeInTheDocument();
    expect(localStorage.getItem('petalkeeper.v1')).toContain('Buy stamps');
    expect(window.location.search).toBe('');
  });

  it('records an as-needed tap and a countdown', async () => {
    window.history.pushState({}, '', '/');
    window.location.hash = '';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Add an as-needed item/ }));
    await user.type(screen.getByLabelText('As-needed name'), 'Water plants');
    await user.click(screen.getAllByRole('button', { name: 'Add' }).find((b) => b.closest('form')?.querySelector('[aria-label="As-needed name"]'))!);
    await user.click(screen.getByRole('button', { name: 'Just did: Water plants' }));
    expect(screen.getByText(/last just now/)).toBeInTheDocument();
  });
});
